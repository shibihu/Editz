import React, { useState } from 'react';
import {
  Download,
  Film,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Share2,
} from 'lucide-react';
import { EditProject } from '../types';

interface ExportModalProps {
  project: EditProject;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressStep, setExportProgressStep] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = async () => {
    setIsExporting(true);
    setError(null);
    setDownloadUrl(null);

    try {
      setExportProgressStep('Cropping & scaling video cuts to 1080x1920...');

      const response = await fetch('/api/render-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timelineClips: project.timelineClips,
          footages: project.footages,
          voiceover: project.voiceover,
          speechSegments: project.speechSegments,
          subtitleStyle: project.subtitleStyle,
        }),
      });

      setExportProgressStep('Burning styled subtitles and multiplexing audio...');

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to export video');
      }

      setDownloadUrl(data.downloadUrl);
      setExportProgressStep('Rendering completed!');
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'An error occurred during video export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg text-sm"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Export 9:16 Vertical Video</h2>
            <p className="text-xs text-zinc-400">
              1080x1920 Full HD · H.264 Video · AAC Audio · TikTok / Shorts / Reels Ready
            </p>
          </div>
        </div>

        {/* Export Specs List */}
        <div className="my-5 grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
              Resolution
            </span>
            <span className="text-zinc-200 font-mono font-medium">1080 × 1920 (9:16)</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
              Cuts & Narration
            </span>
            <span className="text-zinc-200 font-medium">
              {project.timelineClips.length} Clips · {project.speechSegments.length} Captions
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Preview & Download */}
        {downloadUrl ? (
          <div className="flex flex-col items-center gap-4 my-2">
            <div className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Video successfully rendered with FFmpeg & burned subtitles!</span>
            </div>

            {/* Video preview player */}
            <div className="w-44 aspect-[9/16] rounded-xl overflow-hidden bg-black border border-zinc-700 shadow-xl">
              <video
                src={downloadUrl}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center gap-3 w-full">
              <a
                href={downloadUrl}
                download="shortscraft_viral_video.mp4"
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20 text-center flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4 Video</span>
              </a>
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Render Action Button */
          <div className="mt-6 flex flex-col gap-3">
            {isExporting ? (
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-xs font-medium text-zinc-300">{exportProgressStep}</span>
                <span className="text-[10px] text-zinc-500">
                  Processing high-quality H.264 vertical video on server FFmpeg...
                </span>
              </div>
            ) : (
              <button
                onClick={startExport}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Start FFmpeg 1080x1920 MP4 Render</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
