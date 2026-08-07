const axios = require('axios');

axios.get('http://uschat.ruptyl.space:2333/v4/loadtracks', {
  params: { identifier: 'ytsearch:Kalyani' },
  headers: { Authorization: 'muhdumaism@120' }
}).then(res => {
  const d = res.data;
  console.log('loadType:', d.loadType);
  console.log('dataType of data:', typeof d.data, Array.isArray(d.data));
  if (Array.isArray(d.data) && d.data.length > 0) {
    console.log('first item keys:', Object.keys(d.data[0]));
    console.log('first item info:', d.data[0].info);
  } else {
    console.log('data content:', d);
  }
}).catch(err => {
  console.error('ERROR:', err.message);
});
