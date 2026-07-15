export interface VideoQuality {
  id: string;
  label: string;
  format: 'mp4' | 'mp3';
  resolution?: string;
  noWatermark?: boolean;
  directUrl: string;
}

export interface VideoDetails {
  url: string;
  title: string;
  thumbnail: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x' | 'unknown';
  qualities: VideoQuality[];
}
