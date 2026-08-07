const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Resolving stream using Cobalt...');
  try {
    const res = await axios.post('https://api.cobalt.tools/', {
      url: 'https://www.youtube.com/watch?v=xvT1jH8B9AM',
      isAudioOnly: true,
      audioFormat: 'mp3',
      aFormat: 'mp3'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Cobalt response:', res.data);
    if (res.data.url) {
      console.log('Direct stream URL resolved:', res.data.url);
      console.log('Piping audio stream via Axios...');
      const streamRes = await axios.get(res.data.url, { responseType: 'stream' });
      const writeStream = fs.createWriteStream(path.join(__dirname, 'output_cobalt.mp3'));
      streamRes.data.pipe(writeStream);
      setTimeout(() => {
        console.log('SUCCESS! Cobalt stream piping is working!');
        writeStream.close();
        process.exit(0);
      }, 4000);
    } else {
      console.log('Failed to resolve stream URL from Cobalt.');
    }
  } catch (err) {
    console.error('COBALT ERROR:', err.message);
    if (err.response) {
      console.error('COBALT ERROR RESPONSE:', err.response.data);
    }
  }
}
main();
