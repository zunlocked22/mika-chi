const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// This tells fluent-ffmpeg where to find the ffmpeg executable
ffmpeg.setFfmpegPath(ffmpegPath);

// ... rest of your code
// ... all the other functions and logic are the same

// The output path for your HLS files
const OUTPUT_DIR = path.join(__dirname, '..', 'streams');
const OUTPUT_FILE = 'gma7.m3u8';
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILE);

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// Function to convert the YouTube stream to HLS
// It now accepts the YouTube URL as an argument
async function convertStreamToHLS(youtubeUrl) {
  console.log(`Starting stream conversion for URL: ${youtubeUrl}`);

  try {
    const getStreamUrlCommand = `yt-dlp -f "best[ext=mp4]" --get-url "${youtubeUrl}"`;

    const { stdout: streamUrl, stderr } = await new Promise((resolve, reject) => {
      exec(getStreamUrlCommand, (err, stdout, stderr) => {
        if (err) {
          console.error('yt-dlp error:', stderr);
          return reject(err);
        }
        resolve({ stdout, stderr });
      });
    });

    console.log('Found stream URL:', streamUrl.trim());

    ffmpeg(streamUrl.trim())
      .outputOptions([
        '-hls_time 10', 
        '-hls_list_size 3',
        '-y'
      ])
      .output(OUTPUT_PATH)
      .on('start', () => {
        console.log('FFmpeg started. Converting stream...');
      })
      .on('end', () => {
        console.log('Stream conversion finished successfully!');
        console.log(`HLS file created at: ${OUTPUT_PATH}`);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err.message);
      })
      .run();

  } catch (error) {
    console.error('An error occurred during the conversion process:', error);
  }
}

module.exports = { convertStreamToHLS };
