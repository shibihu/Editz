import React from 'react';
import {
  Sparkles,
  Sliders,
  RefreshCw,
  Clock,
  Flame,
  Crop,
  Layers,
  Check,
} from 'lucide-react';
import { TimelineClip, Footage, EditProject } from '../types';

interface ClipInspectorProps {
  clip: TimelineClip;
  project: EditProject;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onClose: () => void;
}

export const ClipInspector: React.FC<ClipInspectorProps> = ({
  clip,
  project,
  onUpdateClip,
  onClose,
}) => {
  const currentFootage = project.footages.find((f) => f.id === clip.footageId);

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 border-l border-zinc-800 p-4 overflow-y-auto custom-scrollbar text-zinc-200 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-zinc-100 text-sm">Clip Inspector</h3>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white px-1.5 py-0.5 rounded text-sm"
        >
          ✕
        </button>
      </div>

      {/* AI Reasoning Explanation Highlight */}
      <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/40 shadow-sm">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-300 text-xs mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Editing Rationale</span>
        </div>
        <p className="text-zinc-300 text-xs leading-relaxed">
          {clip.aiReasoning ||
            'Automatically matched to narration cadence and thematic visuals by Gemini.'}
        </p>
      </div>

      {/* Current Footage Info */}
      <div className="mt-4 p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center gap-3">
        {currentFootage?.thumbnailUrl && (
          <img
            src={currentFootage.thumbnailUrl}
            alt={currentFootage.name}
            className="w-14 h-14 rounded object-cover border border-zinc-800 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100 truncate">{currentFootage?.name}</p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
            <span>{currentFootage?.aspectRatio}</span>
            <span>·</span>
            <span>Duration: {currentFootage?.duration.toFixed(1)}s</span>
            {currentFootage?.analysis?.hookScore && (
              <>
                <span>·</span>
                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" /> {currentFootage.analysis.hookScore}/10
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Swap Footage Selector */}
      <div className="mt-4">
        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Replace Footage With:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {project.footages.map((f) => {
            const isCurrent = f.id === clip.footageId;
            return (
              <button
                key={f.id}
                onClick={() => onUpdateClip(clip.id, { footageId: f.id })}
                className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <img
                  src={f.thumbnailUrl}
                  alt={f.name}
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
                <span className="truncate text-[10px] font-medium">{f.name}</span>
                {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 9:16 Vertical Reframing & Zoom Mode */}
      <div className="mt-4">
        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          9:16 Framing & Animation:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'fill-center', label: 'Center Crop (9:16)' },
            { id: 'slow-zoom', label: 'Cinematic Push-In' },
            { id: 'pan', label: 'Subtle Pan' },
            { id: 'fit', label: 'Fit to Screen' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => onUpdateClip(clip.id, { zoomMode: mode.id as any })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                clip.zoomMode === mode.id
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source Video Trim Slider (In-point offset) */}
      <div className="mt-4 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider">
            Source In-Point (Trim Start)
          </span>
          <span className="font-mono text-zinc-300">{clip.trimStart.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, (currentFootage?.duration || 10) - clip.duration)}
          step="0.1"
          value={clip.trimStart}
          onChange={(e) => {
            const newTrim = parseFloat(e.target.value);
            onUpdateClip(clip.id, {
              trimStart: newTrim,
              trimEnd: newTrim + clip.duration,
            });
          }}
          className="w-full accent-indigo-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span>0.0s</span>
          <span>Max: {((currentFootage?.duration || 10) - clip.duration).toFixed(1)}s</span>
        </div>
      </div>

      {/* Subtitle text tied to this segment */}
      <div className="mt-4">
        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Subtitle Text in this Cut:
        </label>
        <textarea
          rows={2}
          value={clip.subtitleText}
          onChange={(e) => onUpdateClip(clip.id, { subtitleText: e.target.value })}
          className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
};
