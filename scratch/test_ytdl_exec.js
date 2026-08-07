const ytdl = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Resolving stream using yt-dlp stdout pipe...');
  
  const netscapePath = path.join(__dirname, '../youtube_cookies.txt');

  try {
    const options = {
      output: '-',
      format: 'bestaudio',
      jsRuntimes: 'node:' + process.execPath,
    };

    if (fs.existsSync(netscapePath)) {
      options.cookies = netscapePath;
      console.log('Using Netscape cookies...');
    }

    // Call ytdl.exec to get the child process instance
    const subprocess = ytdl.exec('https://www.youtube.com/watch?v=xvT1jH8B9AM', options);
    console.log('Process spawned successfully!');

    const writeStream = fs.createWriteStream(path.join(__dirname, 'output_pipe.webm'));
    subprocess.stdout.pipe(writeStream);

    subprocess.on('error', (err) => {
      console.error('PROCESS ERROR:', err.message);
    });

    subprocess.stderr.on('data', (data) => {
      console.log('STDERR:', data.toString().trim());
    });

    setTimeout(() => {
      console.log('SUCCESS! stdout piping is working!');
      subprocess.kill();
      writeStream.close();
      process.exit(0);
    }, 5000);

  } catch (err) {
    console.error('SPAWN ERROR:', err.message);
  }
}

main();
