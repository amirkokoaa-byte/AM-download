import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import ytdl from '@distube/ytdl-core';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/fetch-video', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'الرابط مطلوب' });
      }

      const platform = determinePlatform(url);

      if (platform === 'tiktok') {
        const tikwmResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const tikwmData = await tikwmResponse.json();

        if (tikwmData.code === 0 && tikwmData.data) {
          return res.json({
            title: tikwmData.data.title || 'فيديو تيك توك',
            thumbnail: tikwmData.data.cover || '',
            direct_url: tikwmData.data.play,
            platform: 'tiktok'
          });
        } else {
          throw new Error(tikwmData.msg || 'فشل جلب بيانات تيك توك من API الخارجي');
        }
      } else if (platform === 'youtube') {
        try {
          const info = await ytdl.getInfo(url);
          
          let format = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo', quality: 'highest' });
          
          if (!format || !format.url) {
             format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
          }

          if (!format || !format.url) {
            throw new Error('لم يتم العثور على رابط التحميل المباشر من يوتيوب.');
          }

          return res.json({
            title: info.videoDetails.title || 'فيديو يوتيوب',
            thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
            direct_url: format.url,
            platform: 'youtube'
          });
        } catch (error: any) {
          console.warn('ytdl-core failed, falling back to RapidAPI:', error.message);
          return await fetchFromRapidAPI(url, res, platform);
        }
      } else {
        // Instagram, Facebook, X using RapidAPI
        return await fetchFromRapidAPI(url, res, platform);
      }
    } catch (error: any) {
      console.error('Fetch Error:', error);
      res.status(500).json({ error: error.message || 'فشل في جلب بيانات الفيديو. يرجى التأكد من صحة الرابط أو المحاولة لاحقاً.' });
    }
  });

  async function fetchFromRapidAPI(url: string, res: any, platform: string) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      throw new Error(`تعذر استخدام ytdl-core (مطلوب تسجيل الدخول لتخطي الحماية). يرجى إضافة مفتاح RAPIDAPI_KEY في إعدادات البيئة لاستخدام الخدمة البديلة لـ ${platform}.`);
    }

    // Example using a generic "Social Media Video Downloader" RapidAPI endpoint
    const rapidApiHost = 'social-media-video-downloader.p.rapidapi.com';
    const rapidApiUrl = `https://${rapidApiHost}/smvd/get/all?url=${encodeURIComponent(url)}`;
    
    const rapidResponse = await fetch(rapidApiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': rapidApiHost
      }
    });

    if (!rapidResponse.ok) {
       const errText = await rapidResponse.text();
       throw new Error(`RapidAPI Error: ${rapidResponse.status} - ${errText}`);
    }

    const data = await rapidResponse.json();
    
    // Handling generic RapidAPI response structures
    const directUrl = data.links?.[0]?.link || data.video_url || data.url || data.src || (data.data && data.data.videoUrl);
    
    if (!directUrl) {
      throw new Error('لم يتم العثور على رابط التحميل المباشر من RapidAPI.');
    }

    return res.json({
      title: data.title || 'فيديو جاهز للتحميل',
      thumbnail: data.picture || data.thumbnail || data.cover || '',
      direct_url: directUrl,
      platform: platform
    });
  }

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
