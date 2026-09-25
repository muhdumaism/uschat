const axios = require('axios');

async function test() {
  const instances = [
    'https://invidious.asir.dev',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.incogniweb.net'
  ];
  
  for (const baseUrl of instances) {
    try {
      console.log(`Testing ${baseUrl}...`);
      const res = await axios.get(`${baseUrl}/api/v1/videos/z5y8Clp_TdE`, { timeout: 5000 });
      if (res.data && res.data.formatStreams) {
        const audioStreams = res.data.formatStreams.filter(f => f.type && f.type.includes('audio'));
        if (audioStreams.length > 0) {
           console.log(`✅ SUCCESS with ${baseUrl} - Audio URL:`, audioStreams[0].url.substring(0, 50) + '...');
           return;
        }
      }
      console.log(`❌ FAILED with ${baseUrl} - No audio streams found.`);
    } catch (err) {
      console.log(`❌ FAILED with ${baseUrl} - ${err.message}`);
    }
  }
}

test();
