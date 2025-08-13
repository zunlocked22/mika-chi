const express = require('express');
const path = require('path');
const { convertStreamToHLS } = require('./convert');

const app = express();
const port = process.env.PORT || 3000;

// Use built-in middleware to parse JSON request bodies
app.use(express.json());

// Serve the static HTML file from the 'public' directory
app.use(express.static('public'));

// Define the path to the persistent disk's streams directory
const STREAMS_DIR = '/var/data/streams';
// Use the directory for your static files
app.use('/streams', express.static(STREAMS_DIR));

// A simple endpoint to trigger the conversion process
app.post('/convert', (req, res) => {
  const { url } = req.body;
  console.log(`Conversion request received for URL: ${url}`);

  if (!url) {
    return res.status(400).send('Error: YouTube URL is required.');
  }

  // Start the conversion process in the background
  convertStreamToHLS(url)
    .then(() => {
      console.log('Conversion process has been started successfully.');
    })
    .catch(err => {
      console.error('Error starting conversion:', err);
    });

  // Send an immediate response to the user
  res.status(202).send('Conversion process initiated. The stream will be available soon at /streams/gma7.m3u8');
});

app.listen(port, () => {
  console.log(`Web server listening on port ${port}.`);
  console.log(`Open http://localhost:${port} in your browser to get started.`);
});
