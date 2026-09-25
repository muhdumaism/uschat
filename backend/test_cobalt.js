const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: 'https://www.youtube.com/watch?v=z5y8Clp_TdE',
      aFormat: 'mp3',
      isAudioOnly: true
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'USCHAT-Backend-Engine'
      }
    });
    console.log('✅ COBALT SUCCESS:', res.data);
  } catch (e) {
    console.log('❌ COBALT FAILED:', e.message, e.response?.data);
  }
}

test();
