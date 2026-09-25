const ytdl = require('@distube/ytdl-core');

async function test() {
  try {
    console.log('Fetching info for z5y8Clp_TdE without cookies...');
    const info = await ytdl.getInfo('https://www.youtube.com/watch?v=z5y8Clp_TdE');
    console.log('SUCCESS! Title:', info.videoDetails.title);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    console.log('Found audio stream URL:', format.url ? 'Yes' : 'No');
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

test();
