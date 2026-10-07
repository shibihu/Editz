import React from 'react';
import { Sparkles, Download, RefreshCw, Film, PlayCircle, Layers } from 'lucide-react';
import { EditProject } from '../types';

interface HeaderProps {
  project: EditProject;
  onLoadSample: () => void;
  onRegenerate: () => void;
  onOpenExport: () => void;
  isLoadingSample: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onLoadSample,
  onRegenerate,
  onOpenExport,
  isLoadingSample,
}) => {
  const hasClips = project.timelineClips.length > 0;
  const footageCount = project.footages.length;

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
              ShortsCraft <span className="text-indigo-400">AI</span>
            </h1>
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 uppercase tracking-wider">
              9:16 Shorts & Reels
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{footageCount} Footages</span>
            <span aria-hidden="true">·</span>
            <span>{project.voiceover ? `${project.voiceover.duration.toFixed(1)}s Audio` : 'No Voiceover'}</span>
            <span aria-hidden="true">·</span>
            <span>{hasClips ? `${project.timelineClips.length} AI Cuts` : 'Draft'}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onLoadSample}
          disabled={isLoadingSample || project.isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-300 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-700/60 transition-colors disabled:opacity-50"
          title="Load pre-built sample project with video clips, voiceover, and script"
        >
          <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isLoadingSample ? 'animate-spin' : ''}`} />
          <span>{isLoadingSample ? 'Loading Demo...' : 'Load Demo Project'}</span>
        </button>

        {hasClips && (
          <button
            onClick={onRegenerate}
            disabled={project.isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-300 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-700/60 transition-colors disabled:opacity-50"
            title="Re-run AI footage matching and pacing algorithm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${project.isProcessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerate Edit</span>
          </button>
        )}

        <button
          onClick={onOpenExport}
          disabled={!hasClips || project.isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-md shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 9:16 MP4</span>
        </button>
      </div>
    </header>
  );
};
