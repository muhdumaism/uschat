const axios = require('axios');
const fs = require('fs');
const path = require('path');

// List of public, reliable Invidious instances
const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.projectsegfau.lt',
  'https://inv.tux.pizza',
  'https://invidious.nerd.net',
  'https://invidious.slipfox.xyz'
];

async function tryResolve(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    console.log(`Attempting to resolve via ${instance}...`);
    try {
      const res = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: 4000 });
      if (res.data && res.data.adaptiveFormats) {
        // Find best audio-only format
        const audioFormat = res.data.adaptiveFormats
          .filter(f => f.mimeType && f.mimeType.startsWith('audio/'))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (audioFormat && audioFormat.url) {
          console.log(`Successfully resolved stream URL from ${instance}!`);
          return audioFormat.url;
        }
      }
    } catch (e) {
      console.warn(`Instance ${instance} failed: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  const videoId = 'xvT1jH8B9AM';
  const url = await tryResolve(videoId);
  if (url) {
    console.log('Stream URL:', url);
    console.log('Piping audio stream via Axios...');
    try {
      const streamRes = await axios.get(url, { responseType: 'stream', timeout: 5000 });
      const writeStream = fs.createWriteStream(path.join(__dirname, 'output_invidious.webm'));
      streamRes.data.pipe(writeStream);
      setTimeout(() => {
        console.log('SUCCESS! Invidious stream piping is working!');
        writeStream.close();
        process.exit(0);
      }, 4000);
    } catch (err) {
      console.error('INVIDIOUS STREAM ERROR:', err.message);
    }
  } else {
    console.error('Failed to resolve stream URL from all Invidious instances.');
  }
}

main();
