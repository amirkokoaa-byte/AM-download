/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { DownloadCloud } from 'lucide-react';
import DownloaderForm from './components/DownloaderForm';
import { VideoDetails } from './types';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Note: Mock functions are avoided as requested, these are just placeholder handlers
  // ready to receive real implementation in the next steps.
  
  const handleCheckLink = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setVideoDetails(null);
    
    try {
      const response = await fetch('/api/fetch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء فحص الرابط.');
      }
      
      setVideoDetails(data);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء فحص الرابط.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (qualityId: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    
    try {
      const quality = videoDetails?.qualities.find(q => q.id === qualityId);
      if (!quality || !quality.directUrl) {
        throw new Error('لم يتم العثور على رابط التحميل المباشر.');
      }
      
      const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(quality.directUrl)}&title=${encodeURIComponent(videoDetails?.title || 'video')}&format=${encodeURIComponent(quality.format)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('حدث خطأ أثناء محاولة جلب الملف من الخادم.');
      }

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('فشل في قراءة بيانات الملف.');
      }

      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total > 0) {
            setDownloadProgress(Math.round((loaded / total) * 100));
          } else {
             // Fake progress if total length is unknown
             setDownloadProgress(prev => Math.min(prev + 5, 95));
          }
        }
      }
      
      setDownloadProgress(100);
      
      // Create blob and force download
      const blob = new Blob(chunks, { type: quality.format === 'mp3' ? 'audio/mpeg' : 'video/mp4' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      // Extract filename from Content-Disposition if available
      let filename = `${videoDetails?.title?.replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '').trim() || 'video'}.${quality.format}`;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
           filename = decodeURIComponent(match[1]);
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
    } catch (err: any) {
      console.error('Download failed:', err);
      setError(err.message || 'حدث خطأ أثناء بدء التحميل.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Header */}
      <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-4 px-6 sticky top-0 z-10" dir="rtl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <DownloadCloud className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              محمل الفيديوهات الشامل
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 flex flex-col items-center">
        
        <div className="text-center mb-12 max-w-2xl" dir="rtl">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-gray-900 dark:text-white leading-tight">
            حمّل الفيديوهات من <span className="text-blue-600">أي منصة</span> بسهولة
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            أداة سريعة ومجانية لتحميل الفيديوهات من يوتيوب، تيك توك، إنستجرام، إكس، وفيسبوك بأعلى جودة وبدون علامة مائية.
          </p>
        </div>

        <DownloaderForm 
          onCheckLink={handleCheckLink}
          isLoading={isLoading}
          error={error}
          videoDetails={videoDetails}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
        />

        {/* Supported Platforms Grid */}
        <div className="mt-20 w-full max-w-3xl border-t border-gray-200 dark:border-gray-800 pt-10">
          <p className="text-center text-sm text-gray-500 mb-6" dir="rtl">
            المنصات المدعومة
          </p>
          <div className="flex flex-wrap justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
            <div className="font-bold text-xl text-gray-700 dark:text-gray-300">YouTube</div>
            <div className="font-bold text-xl text-gray-700 dark:text-gray-300">TikTok</div>
            <div className="font-bold text-xl text-gray-700 dark:text-gray-300">Instagram</div>
            <div className="font-bold text-xl text-gray-700 dark:text-gray-300">Facebook</div>
            <div className="font-bold text-xl text-gray-700 dark:text-gray-300">X (Twitter)</div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 text-center text-gray-500">
        <p dir="rtl">© {new Date().getFullYear()} محمل الفيديوهات الشامل. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}
