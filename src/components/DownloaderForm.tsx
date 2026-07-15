import React, { useState } from 'react';
import { Search, Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { VideoDetails } from '../types';

interface DownloaderFormProps {
  onCheckLink: (url: string) => void;
  isLoading: boolean;
  error?: string | null;
  videoDetails?: VideoDetails | null;
  onDownload: () => void;
  isDownloading: boolean;
  downloadProgress: number;
}

export default function DownloaderForm({
  onCheckLink,
  isLoading,
  error,
  videoDetails,
  onDownload,
  isDownloading,
  downloadProgress,
}: DownloaderFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onCheckLink(url.trim());
    }
  };

  const handleDownloadClick = () => {
    onDownload();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-3" dir="rtl">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ضع رابط الفيديو هنا (YouTube, TikTok, Instagram, X...)"
              className="block w-full pr-12 pl-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              'فحص الرابط'
            )}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400" dir="rtl">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </form>

      {videoDetails && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700" dir="rtl">
            <div className="w-full md:w-48 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 relative">
              {videoDetails.thumbnail ? (
                <img
                  src={videoDetails.thumbnail}
                  alt={videoDetails.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  لا توجد صورة
                </div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 mb-2">
                  {videoDetails.title}
                </h3>
                <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-full">
                  {videoDetails.platform.charAt(0).toUpperCase() + videoDetails.platform.slice(1)}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="relative">
                  <button
                    onClick={handleDownloadClick}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden z-10"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 relative z-10" />
                        <span className="relative z-10">جاري التحميل... {downloadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5" />
                        <span>تحميل</span>
                      </>
                    )}
                    
                    {/* Progress Bar Background */}
                    {isDownloading && (
                      <div 
                        className="absolute bottom-0 right-0 h-full bg-green-500/50 transition-all duration-300 ease-out z-0"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
