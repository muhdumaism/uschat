const play = require('play-dl');

async function test() {
  try {
    console.log('Testing play-dl extraction...');
    const stream = await play.stream('https://www.youtube.com/watch?v=z5y8Clp_TdE');
    console.log('✅ PLAY-DL SUCCESS! Stream URL found.');
  } catch (err) {
    console.log('❌ PLAY-DL FAILED:', err.message);
  }
}

test();
