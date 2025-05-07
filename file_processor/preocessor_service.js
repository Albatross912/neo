const express = require("express");
const fs = require("fs");
const { Pool } = require("pg");
const csv = require("csv-parser");
const path = require("path");
const { Transform } = require("stream");
const copyFrom = require("pg-copy-streams").from;

const envPath = path.join(__dirname, "..", ".env");
console.log("Looking for .env file at:", envPath);
require("dotenv").config({ path: envPath });

const app = express();
const PORT = 3002;

// Check if environment variables are loaded correctly
if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not defined in .env file");
  process.exit(1);
} 

// PostgreSQL Setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
    console.error("Please check if:");
    console.error("1. PostgreSQL is running");
    console.error("2. Database credentials are correct");
    console.error("3. Database port is correct (default: 5432)");
    process.exit(1);
  } else {
    console.log("Successfully connected to database");
    release();
  }
});

app.use(express.json());

// POST /upload
app.post("/upload", async (req, res) => {
  const { path } = req.body;
  if (!path || !fs.existsSync(path)) {
    return res.status(400).json({
      error: "Invalid file path",
      message: "File path is invalid or missing",
    });
  }

  let client;
  let columns;

  try {
    client = await pool.connect();

    // First, read the CSV headers
    const headerStream = fs.createReadStream(path).pipe(csv());
    const firstRow = await new Promise((resolve, reject) => {
      headerStream.once("data", (data) => {
        headerStream.destroy();
        resolve(data);
      });
      headerStream.once("error", reject);
    });

    columns = Object.keys(firstRow);

    // Drop existing table if it exists
    await client.query("DROP TABLE IF EXISTS csv_data");

    // Create table with proper column names
    const createTableQuery = `
      CREATE TABLE csv_data (
        ${columns.map((col) => `"${col.trim()}" TEXT`).join(", ")}
      )
    `;
    console.log("Creating table with query:", createTableQuery);
    await client.query(createTableQuery);

    // Begin transaction
    await client.query("BEGIN");

    // Create a transform stream to convert CSV rows to tab-separated values
    const transformStream = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const values = columns.map((col) => {
          const value = chunk[col];
          return value === undefined || value === null ? "\\N" : value;
        });
        callback(null, values.join("\t") + "\n");
      },
    });

    // Use COPY command for bulk insert
    const copyQuery = `COPY csv_data (${columns
      .map((col) => `"${col.trim()}"`)
      .join(
        ", "
      )}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')`;
    const copyStream = client.query(copyFrom(copyQuery));

    // Handle copy stream errors
    copyStream.on("error", async (err) => {
      await client.query("ROLLBACK");
      console.error("Error during COPY:", err);
      res.status(500).json({
        error: "Database error",
        message: "Error uploading CSV to DB",
        details: err.message,
      });
    });

    // Handle copy stream finish
    copyStream.on("finish", async () => {
      try {
        await client.query("COMMIT");
        res.json({
          message: "CSV uploaded to PostgreSQL successfully",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

    // Pipe the CSV through our transform stream to the COPY command
    fs.createReadStream(path)
      .pipe(csv())
      .pipe(transformStream)
      .pipe(copyStream);
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error("Error:", err.message);
    res.status(500).json({
      error: "Database error",
      message: "Error uploading CSV to DB",
      details: err.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  pool.end(() => {
    console.log("Pool has ended");
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`CSV Uploader running on http://localhost:${PORT}`);
});
