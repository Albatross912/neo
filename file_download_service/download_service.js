const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());

// POST /download
app.post('/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send("URL is required");

    const filename = path.basename(url);
    const filepath = path.join(__dirname, 'downloads', filename);

    try {
        const response = await axios({ url, responseType: 'stream' });
        const writer = fs.createWriteStream(filepath);

        response.data.pipe(writer);

        writer.on('finish', () => {
            res.json({
                message: "File downloaded successfully",
                path: filepath
            });
        });

        writer.on('error', (err) => {
            res.status(500).send("Error saving file");
        });

    } catch (err) {
        res.status(500).send("Error downloading file");
    }
});

app.listen(PORT, () => {
    console.log(`CSV Downloader running on http://localhost:${PORT}`);
});