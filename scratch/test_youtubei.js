const { Innertube } = require('youtubei.js');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

async function main() {
  console.log('Initializing Innertube client...');
  const youtube = await Innertube.create();
  console.log('Innertube client initialized successfully.');

  const videoUrl = 'https://www.youtube.com/watch?v=xvT1jH8B9AM';
  // Extract video ID from URL
  const videoId = videoUrl.split('v=')[1]?.split('&')[0];
  console.log('Video ID extracted:', videoId);

  try {
    const info = await youtube.getInfo(videoId);
    console.log('Video title resolved:', info.basic_info.title);

    console.log('Requesting audio stream...');
    const webStream = await info.download({
      type: 'audio',
      quality: 'best',
    });

    console.log('Web stream acquired. Wrapping in node Readable...');
    const nodeStream = Readable.fromWeb(webStream);
    console.log('Stream wrapped successfully.');

    // Save 100kb to test write
    const writeStream = fs.createWriteStream(path.join(__dirname, 'test_output.webm'));
    nodeStream.pipe(writeStream);

    console.log('Piping stream to file...');
    setTimeout(() => {
      console.log('Test successful! Closing stream.');
      writeStream.close();
      process.exit(0);
    }, 3000);
  } catch (err) {
    console.error('ERROR during stream extract:', err.message);
    console.error(err.stack);
  }
}

main();
