const ytdl = require('@ybd-project/ytdl-core');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Convert JSON cookies into a Cookie header string
const cookiesPath = path.join(__dirname, '../youtube_cookies.json');
let cookieHeader = '';
if (fs.existsSync(cookiesPath)) {
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('Cookie header formatted.');
}

const uri = 'https://www.youtube.com/watch?v=xvT1jH8B9AM';

async function run() {
  try {
    // Only request mobile client players that serve undeciphered streams
    const core = new ytdl.default({
      clients: ['mweb', 'ios', 'android']
    });
    console.log('Instantiated core with mobile-only clients.');

    console.log('Fetching full info...');
    const info = await core.getFullInfo(uri, {
      requestOptions: {
        headers: {
          Cookie: cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    const filterFn = ytdl.filterFormats || ytdl.default.filterFormats;
    const formats = filterFn(info.formats, 'audioonly');
    if (formats.length === 0) {
      throw new Error('No audio formats found!');
    }

    // Select the best quality audio format
    const selectedFormat = formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    console.log('Selected format direct URL:', selectedFormat.url);

    console.log('Streaming format URL via Axios...');
    const response = await axios.get(selectedFormat.url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log('Stream acquired. Piping to output file...');
    const writeStream = fs.createWriteStream(path.join(__dirname, 'output_axios.webm'));
    response.data.pipe(writeStream);

    setTimeout(() => {
      console.log('SUCCESS! Axios stream pipe is working!');
      writeStream.close();
      process.exit(0);
    }, 4000);
  } catch (err) {
    console.error('STREAM ERROR:', err.message);
    if (err.response) {
      console.error('RESPONSE ERROR STATUS:', err.response.status);
    }
  }
}

run();
