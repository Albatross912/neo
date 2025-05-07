const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = 3001;

// Database pool configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
  } else {
    console.log("Successfully connected to database");
    release();
  }
});

// Create downloads directory in parent folder if it doesn't exist
const downloadsDir = path.join(__dirname, "..", "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use(express.json());

// POST /download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send("URL is required");

  const filename = path.basename(url);
  const filepath = path.join(__dirname, "..", "downloads", filename);

  try {
    const response = await axios({ url, responseType: "stream" });
    const writer = fs.createWriteStream(filepath, { flags: "w" });

    response.data.pipe(writer);

    writer.on("finish", () => {
      res.json({
        message: "File downloaded successfully",
        path: filepath,
      });
    });

    writer.on("error", (err) => {
      console.error("Error writing file:", err);
      res.status(500).json({
        error: "Error saving file",
        details: err.message,
      });
    });
  } catch (err) {
    console.error("Error downloading file:", err);
    res.status(500).json({
      error: "Error downloading file",
      details: err.message,
    });
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
  console.log(`CSV Downloader running on http://localhost:${PORT}`);
});
