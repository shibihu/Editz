/**
 * Utility functions for client-side media extraction and analysis
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  thumbnailUrl: string;
}

/**
 * Capture thumbnail and metadata from a video File or URL
 */
export async function extractVideoMetadata(source: File | string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    video.src = url;

    video.onloadedmetadata = () => {
      // Seek to 1s or 25% of duration for a good representative thumbnail
      const seekTime = Math.min(1.0, video.duration * 0.25);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        const duration = video.duration || 5;

        // Calculate aspect ratio string
        const ratio = width / height;
        let aspectRatio = '16:9';
        if (ratio < 0.7) aspectRatio = '9:16';
        else if (ratio < 1.1 && ratio > 0.9) aspectRatio = '1:1';
        else if (ratio < 1.5) aspectRatio = '4:5';

        // Draw thumbnail frame to canvas
        const canvas = document.createElement('canvas');
        const thumbWidth = 320;
        const thumbHeight = Math.round((thumbWidth / width) * height);
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        }
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Revoke if we created a temporary blob url
        if (typeof source !== 'string') {
          // Keep URL alive for playback, don't revoke yet
        }

        resolve({
          duration,
          width,
          height,
          aspectRatio,
          thumbnailUrl,
        });
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video file for metadata extraction'));
    };
  });
}

/**
 * Decode audio file to extract waveform peaks [0..1]
 */
export async function extractAudioWaveform(
  source: File | string,
  peakCount = 80
): Promise<{ duration: number; waveform: number[] }> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof source === 'string') {
      const resp = await fetch(source);
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await source.arrayBuffer();
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;
    const blockSize = Math.floor(channelData.length / peakCount);
    const peaks: number[] = [];

    for (let i = 0; i < peakCount; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(channelData[start + j] || 0);
        if (val > max) max = val;
      }
      peaks.push(Math.min(1, Math.max(0.05, max)));
    }

    await audioCtx.close();
    return { duration, waveform: peaks };
  } catch (err) {
    console.warn('Could not decode audio waveform, using synthetic peaks:', err);
    // Return synthetic waveform fallback
    const peaks = Array.from({ length: peakCount }, (_, i) =>
      0.2 + 0.6 * Math.abs(Math.sin(i * 0.4) * Math.cos(i * 0.2))
    );
    return { duration: 12, waveform: peaks };
  }
}

/**
 * Format seconds into MM:SS.m
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
