const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const csv = require('csv-parser');

const app = express();
const PORT = 3002;

// MongoDB Setup
mongoose.connect('mongodb://localhost:27017/csvdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Simple Mongoose Model
const CsvData = mongoose.model('CsvData', new mongoose.Schema({}, { strict: false }));

app.use(express.json());

// POST /upload
app.post('/upload', async (req, res) => {
    const { path } = req.body;
    if (!path || !fs.existsSync(path)) {
        return res.status(400).send("File path is invalid or missing");
    }

    const results = [];

    fs.createReadStream(path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            await CsvData.insertMany(results);
            res.json({ message: "CSV uploaded to DB", count: results.length });
        })
        .on('error', (err) => {
            res.status(500).send("Error parsing CSV");
        });
});

app.listen(PORT, () => {
    console.log(`CSV Uploader running on http://localhost:${PORT}`);
});