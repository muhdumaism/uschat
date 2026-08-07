const play = require('play-dl');
const fs = require('fs');
const path = require('path');

// Convert JSON cookies into a Cookie header string
const cookiesPath = path.join(__dirname, '../youtube_cookies.json');
let cookieHeader = '';
if (fs.existsSync(cookiesPath)) {
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function main() {
  if (cookieHeader) {
    console.log('Loading cookies in play-dl...');
    try {
      await play.setToken({
        youtube: {
          cookie: cookieHeader
        }
      });
      console.log('Cookies loaded successfully.');
    } catch (e) {
      console.warn('Failed to load cookies in play-dl:', e.message);
    }
  }

  console.log('Resolving stream using play-dl...');
  try {
    const stream = await play.stream('https://www.youtube.com/watch?v=xvT1jH8B9AM');
    console.log('Stream acquired! Piping to output file...');
    const writeStream = fs.createWriteStream(path.join(__dirname, 'output_playdl.webm'));
    stream.stream.pipe(writeStream);
    setTimeout(() => {
      console.log('SUCCESS! play-dl is working!');
      writeStream.close();
      process.exit(0);
    }, 3000);
  } catch (err) {
    console.error('PLAY-DL ERROR:', err.message);
    console.error(err.stack);
  }
}
main();
