import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import youtubedl from 'youtube-dl-exec';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/fetch-video', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'الرابط مطلوب' });
    }

    const platform = determinePlatform(url);

    if (platform === 'tiktok') {
      try {
        const tikwmResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const tikwmData = await tikwmResponse.json();

        if (tikwmData.code === 0 && tikwmData.data) {
          const videoDetails = {
            url: url,
            title: tikwmData.data.title || 'فيديو تيك توك',
            thumbnail: tikwmData.data.cover || '',
            platform: 'tiktok',
            qualities: [
              {
                id: 'tiktok-nowatermark',
                label: 'بدون علامة مائية',
                format: 'mp4',
                noWatermark: true,
                directUrl: tikwmData.data.play
              }
            ]
          };
          
          if (tikwmData.data.music) {
            videoDetails.qualities.push({
                id: 'tiktok-audio',
                label: 'صوت (Audio)',
                format: 'mp3',
                noWatermark: true,
                directUrl: tikwmData.data.music
            });
          }
          
          return res.json(videoDetails);
        } else {
            throw new Error(tikwmData.msg || 'فشل جلب بيانات تيك توك من API الخارجي');
        }
      } catch (tiktokError: any) {
        console.error('TikTok Fetch Error:', tiktokError);
        return res.status(500).json({ error: 'فشل في جلب بيانات تيك توك. يرجى المحاولة لاحقاً.' });
      }
    }

    try {
      // Use youtube-dl-exec to fetch metadata and direct URLs
      const rawInfo = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
      });
      
      const info = rawInfo as any;
      
      // Extract available formats and map them to our VideoQuality interface
      const qualities = info.formats
        ?.filter((f: any) => f.url && f.ext !== 'mhtml' && f.ext !== 'html')
        ?.map((f: any) => {
          const isAudioOnly = f.vcodec === 'none' && f.acodec !== 'none';
          const formatStr = isAudioOnly ? 'mp3' : 'mp4';
          const label = isAudioOnly ? 'صوت (Audio)' : (f.format_note || f.resolution || 'غير معروف');
          return {
            id: f.format_id || Math.random().toString(36).substring(7),
            label: label,
            format: formatStr,
            resolution: f.resolution,
            // For platforms like Instagram, youtube-dl-exec often gets the raw media URL
            noWatermark: platform === 'instagram',
            directUrl: f.url
          };
        }) || [];

      // Sort qualities (best resolution first, then audio)
      const sortedQualities = qualities.sort((a: any, b: any) => {
        if (a.format === 'mp3' && b.format !== 'mp3') return 1;
        if (a.format !== 'mp3' && b.format === 'mp3') return -1;
        const resA = parseInt(a.resolution?.split('x')[1] || '0');
        const resB = parseInt(b.resolution?.split('x')[1] || '0');
        return resB - resA;
      });

      // Filter out duplicate labels to keep UI clean
      const uniqueQualities: any[] = [];
      const seenLabels = new Set();
      for (const q of sortedQualities) {
        const key = `${q.format}-${q.resolution || q.label}`;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          uniqueQualities.push(q);
        }
      }

      const videoDetails = {
        url: url,
        title: info.title || 'فيديو غير معروف',
        thumbnail: info.thumbnail || '',
        platform: platform,
        qualities: uniqueQualities.length > 0 ? uniqueQualities : [{
          id: 'default',
          label: 'جودة تلقائية',
          format: 'mp4',
          noWatermark: platform === 'instagram',
          directUrl: info.url
        }]
      };

      res.json(videoDetails);
    } catch (error: any) {
      console.error('Download error (yt-dlp):', error);
      res.status(500).json({ error: 'فشل في جلب بيانات الفيديو. يرجى التأكد من صحة الرابط أو المحاولة لاحقاً.' });
    }
  });

  function determinePlatform(url: string): string {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'x';
    return 'unknown';
  }

  app.get('/api/download-proxy', async (req, res) => {
    const { url, title, format } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'الرابط مطلوب' });
    }

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: 'فشل جلب الملف الأصلي' });
      }

      const safeTitle = (typeof title === 'string' ? title : 'video').replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '').trim() || 'video';
      const ext = typeof format === 'string' ? format : 'mp4';
      const filename = `${safeTitle}.${ext}`;

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      
      if (response.headers.has('content-length')) {
        res.setHeader('Content-Length', response.headers.get('content-length') as string);
      }

      // Stream the response to the client
      if (response.body) {
        // We can cast the web stream to a node stream or just use arrayBuffer if we want to be simple,
        // but streaming is better for large files.
        const reader = response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (error: any) {
      console.error('Proxy Download Error:', error);
      res.status(500).json({ error: 'فشل في تمرير الملف.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
