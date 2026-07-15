import { NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'الرابط مطلوب' },
        { status: 400 }
      );
    }

    const platform = determinePlatform(url);

    // معالجة خاصة لروابط تيك توك لتفادي مشاكل yt-dlp على السيرفر
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
          
          return NextResponse.json(videoDetails);
        } else {
            throw new Error(tikwmData.msg || 'فشل جلب بيانات تيك توك من API الخارجي');
        }
      } catch (tiktokError: any) {
        console.error('TikTok Fetch Error:', tiktokError);
        return NextResponse.json(
          { error: 'فشل في جلب بيانات تيك توك. يرجى المحاولة لاحقاً.' },
          { status: 500 }
        );
      }
    }

    // استخدم youtube-dl-exec لجلب بيانات الفيديو والروابط المباشرة لباقي المنصات
    const rawInfo = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    const info = rawInfo as any;
    
    // استخراج الجودات المتاحة
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
          noWatermark: platform === 'instagram',
          directUrl: f.url
        };
      }) || [];

    // ترتيب الجودات (الأعلى دقة أولاً، ثم الصوت)
    const sortedQualities = qualities.sort((a: any, b: any) => {
      if (a.format === 'mp3' && b.format !== 'mp3') return 1;
      if (a.format !== 'mp3' && b.format === 'mp3') return -1;
      const resA = parseInt(a.resolution?.split('x')[1] || '0');
      const resB = parseInt(b.resolution?.split('x')[1] || '0');
      return resB - resA;
    });

    // إزالة الجودات المكررة للحفاظ على نظافة واجهة المستخدم
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

    return NextResponse.json(videoDetails);

  } catch (error: any) {
    console.error('Download error (yt-dlp):', error);
    return NextResponse.json(
      { error: 'فشل في جلب بيانات الفيديو. يرجى التأكد من صحة الرابط أو المحاولة لاحقاً.' },
      { status: 500 }
    );
  }
}

function determinePlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'x';
  return 'unknown';
}
