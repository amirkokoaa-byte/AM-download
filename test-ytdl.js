import ytdl from 'youtube-dl-exec';
try {
  const output = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
    dumpSingleJson: true,
    noWarnings: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
  });
  console.log(output.title);
} catch (e) {
  console.error(e.message);
}
