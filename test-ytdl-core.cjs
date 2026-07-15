const ytdl = require('@distube/ytdl-core');
ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ').then(info => {
  const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
  console.log(info.videoDetails.title, format.url);
}).catch(console.error);
