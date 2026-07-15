const ytdl = require('youtube-dl-exec');
ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  dumpSingleJson: true,
  noWarnings: true,
  preferFreeFormats: true,
  youtubeSkipDashManifest: true,
}).then(output => console.log(output.title)).catch(err => console.error(err.message));
