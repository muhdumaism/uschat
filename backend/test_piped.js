const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://pipedapi.kavin.rocks/streams/z5y8Clp_TdE');
    if (res.data && res.data.audioStreams) {
      const bestAudio = res.data.audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
      console.log('✅ PIPED SUCCESS! Audio URL:', bestAudio.url.substring(0, 50) + '...');
    } else {
      console.log('❌ PIPED FAILED: No audio streams found');
    }
  } catch (err) {
    console.log('❌ PIPED FAILED:', err.message);
  }
}

test();
