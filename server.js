// A simple Node.js Express server to handle YouTube to HLS conversion.
// To run this server:
// 1. Make sure you have Node.js installed.
// 2. Make sure you have 'yt-dlp' and 'ffmpeg' installed on your system and in your PATH.
//    - For 'yt-dlp': https://github.com/yt-dlp/yt-dlp#installation
//    - For 'ffmpeg': https://www.ffmpeg.org/download.html
// 3. Create a new directory for this project.
// 4. Create a `package.json` file with `npm init -y`.
// 5. Install the required dependencies: `npm install express`.
// 6. Save this code as `server.js` in the same directory.
// 7. Run the server with `node server.js`.

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3001;

// Middleware to parse JSON requests
app.use(express.json());

// Enable CORS for the front-end application
// In a production environment, you should restrict this to your front-end's domain
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Directory to store the converted HLS streams.
// Make sure this directory exists and is writable.
const streamsDir = path.join(__dirname, 'public', 'streams');
if (!fs.existsSync(streamsDir)) {
    fs.mkdirSync(streamsDir, { recursive: true });
}
app.use(express.static('public'));

// The API endpoint for converting streams
app.post('/api/convert', (req, res) => {
    const { youtubeUrl, channelName } = req.body;

    // Basic input validation
    if (!youtubeUrl || !channelName) {
        return res.status(400).json({ error: 'youtubeUrl and channelName are required' });
    }

    const channelId = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const outputFilename = path.join(streamsDir, `${channelId}.m3u8`);

    // Use a shell command to get the raw stream URL from yt-dlp
    // We'll use a promise to handle the async execution
    const getStreamUrl = () => {
        return new Promise((resolve, reject) => {
            const ytDlpProcess = spawn('yt-dlp', ['--get-url', youtubeUrl]);
            let streamUrl = '';

            ytDlpProcess.stdout.on('data', (data) => {
                streamUrl += data.toString().trim();
            });

            ytDlpProcess.stderr.on('data', (data) => {
                console.error(`yt-dlp stderr: ${data}`);
            });

            ytDlpProcess.on('close', (code) => {
                if (code === 0 && streamUrl) {
                    console.log(`yt-dlp found stream URL: ${streamUrl}`);
                    resolve(streamUrl);
                } else {
                    reject(new Error('Failed to get stream URL with yt-dlp'));
                }
            });
        });
    };

    // Main conversion logic
    const startConversion = async () => {
        try {
            const rawStreamUrl = await getStreamUrl();

            // The ffmpeg command to convert to HLS
            // -i: Input stream
            // -c:v copy -c:a aac: Copy the video stream and re-encode audio to AAC (common for HLS)
            // -f hls: Output format is HLS
            // -hls_time 10: Set segment duration to 10 seconds
            // -hls_playlist_type event: Keep segments in the playlist (useful for live)
            // -hls_flags delete_segments: This is the key to overwriting old files.
            //                             It tells ffmpeg to delete old segment files as new ones are created.
            // -hls_segment_filename: The naming convention for segment files.
            const ffmpegArgs = [
                '-i', rawStreamUrl,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-f', 'hls',
                '-hls_time', '10',
                '-hls_playlist_type', 'event',
                '-hls_flags', 'delete_segments',
                '-hls_segment_filename', path.join(streamsDir, `${channelId}_%03d.ts`),
                outputFilename
            ];

            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
            console.log(`Starting ffmpeg for channel: ${channelName}`);

            ffmpegProcess.stdout.on('data', (data) => {
                console.log(`ffmpeg stdout: ${data}`);
            });

            ffmpegProcess.stderr.on('data', (data) => {
                // FFMPEG logs a lot of info to stderr, which is normal
                console.error(`ffmpeg stderr: ${data}`);
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`ffmpeg process for ${channelName} finished successfully.`);
                } else {
                    console.error(`ffmpeg process for ${channelName} exited with code ${code}`);
                }
            });

            // Respond to the client immediately to avoid timeouts. The conversion runs in the background.
            res.status(200).json({ message: 'Conversion started successfully', m3u8Url: `/streams/${channelId}.m3u8` });

        } catch (error) {
            console.error('Conversion failed:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    startConversion();
});

// The server starts listening on the specified port
app.listen(port, () => {
    console.log(`HLS Conversion Server listening at http://localhost:${port}`);
});
