import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Film,
  Music,
  FileText,
  ZoomIn,
  ZoomOut,
  Scissors,
  Sparkles,
  MoveHorizontal,
  Flame,
} from 'lucide-react';
import { EditProject, TimelineClip, SpeechSegment } from '../types';
import { formatTime } from '../utils/mediaUtils';

interface TimelineProps {
  project: EditProject;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedClip: TimelineClip | null;
  onSelectClip: (clip: TimelineClip) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onUpdateSegment: (segId: string, updates: Partial<SpeechSegment>) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  onSeek,
  selectedClip,
  onSelectClip,
  onUpdateClip,
  onUpdateSegment,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const totalDuration = Math.max(1, project.totalDuration || (project.voiceover?.duration ?? 10));

  // Footage lookup map
  const footageMap = useMemo(() => {
    const map = new Map<string, any>();
    project.footages.forEach((f) => map.set(f.id, f));
    return map;
  }, [project.footages]);

  // Handle click / drag scrub on timeline
  const handleSeekFromEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const seekTime = ratio * totalDuration;
    onSeek(Math.max(0, Math.min(seekTime, totalDuration)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    handleSeekFromEvent(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        handleSeekFromEvent(e);
      }
    };
    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };
    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, totalDuration]);

  // Generate ruler tick marks
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const interval = totalDuration > 30 ? 5 : totalDuration > 15 ? 2 : 1;
    for (let t = 0; t <= totalDuration; t += interval) {
      ticks.push(t);
    }
    return ticks;
  }, [totalDuration]);

  const playheadPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="w-full flex flex-col bg-zinc-950 border-t border-zinc-800 select-none">
      {/* Timeline Controls Header */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-zinc-800/80 text-zinc-400 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-zinc-300 font-semibold text-[11px]">
            {formatTime(currentTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-zinc-500 text-[11px]">
            {formatTime(totalDuration)}
          </span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-400">
            {project.timelineClips.length} Cuts
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom In / Out */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
              className="p-1 hover:text-white rounded disabled:opacity-40"
              disabled={zoomLevel <= 1}
              title="Zoom out timeline"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] px-1 font-mono">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1 hover:text-white rounded disabled:opacity-40"
              disabled={zoomLevel >= 2.5}
              title="Zoom in timeline"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Scrolling Area */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden relative custom-scrollbar"
        style={{ minHeight: '180px' }}
      >
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          className="relative py-2 px-6 cursor-pointer"
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
        >
          {/* 1. Time Ruler */}
          <div className="h-6 relative border-b border-zinc-800/80 mb-2 pointer-events-none">
            {rulerTicks.map((t) => {
              const leftPercent = (t / totalDuration) * 100;
              return (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col justify-end text-[10px] font-mono text-zinc-500"
                  style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="mb-0.5">{formatTime(t)}</span>
                  <div className="w-[1px] h-2 bg-zinc-700 self-center" />
                </div>
              );
            })}
          </div>

          {/* Draggable Playhead Scrubber Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 pointer-events-none transition-none shadow-sm shadow-red-500/50"
            style={{ left: `calc(${playheadPercent}% + 24px - 1px)` }}
          >
            <div className="w-3 h-3.5 bg-red-500 -ml-[5px] -mt-1 rounded-b-sm flex items-center justify-center shadow-md">
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>

          {/* 2. Track 1: Video Clips */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              <Film className="w-3 h-3 text-indigo-400" />
              <span>Video Clips ({project.timelineClips.length})</span>
            </div>

            <div className="h-14 relative bg-zinc-900/60 rounded-lg overflow-hidden border border-zinc-800 flex">
              {project.timelineClips.map((clip, idx) => {
                const footage = footageMap.get(clip.footageId);
                const widthPercent = (clip.duration / totalDuration) * 100;
                const isSelected = selectedClip?.id === clip.id;
                const isActive = currentTime >= clip.timelineStart && currentTime <= clip.timelineEnd;

                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip);
                      onSeek(clip.timelineStart);
                    }}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full relative shrink-0 border-r border-zinc-800/80 flex flex-col justify-between p-1.5 cursor-pointer transition-all overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 z-20 bg-indigo-950/40'
                        : isActive
                        ? 'bg-zinc-800/90'
                        : 'bg-zinc-900/80 hover:bg-zinc-850'
                    }`}
                  >
                    {/* Thumbnail Background / Mini visual preview */}
                    {footage?.thumbnailUrl && (
                      <div
                        className="absolute inset-0 opacity-25 pointer-events-none bg-cover bg-center"
                        style={{ backgroundImage: `url(${footage.thumbnailUrl})` }}
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-zinc-200 truncate pr-1">
                        #{idx + 1} {footage?.name || 'Clip'}
                      </span>
                      {clip.timelineStart <= 3.0 && (
                        <span className="text-[9px] font-bold text-amber-400 flex items-center shrink-0">
                          <Flame className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="relative z-10 flex items-center justify-between text-[9px] text-zinc-400">
                      <span>{clip.duration.toFixed(1)}s</span>
                      <span className="text-zinc-500 uppercase">{clip.zoomMode}</span>
                    </div>

                    {/* AI selection indicator ribbon */}
                    {clip.aiReasoning && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"
                        title={clip.aiReasoning}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Track 2: Voiceover Waveform */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              <Music className="w-3 h-3 text-purple-400" />
              <span>Voiceover Audio {project.voiceover ? `(${project.voiceover.fileName})` : ''}</span>
            </div>

            <div className="h-10 relative bg-zinc-900/60 rounded-lg overflow-hidden border border-zinc-800 flex items-center px-1">
              {project.voiceover?.waveform && project.voiceover.waveform.length > 0 ? (
                <div className="w-full h-full flex items-center gap-0.5 py-1">
                  {project.voiceover.waveform.map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-purple-500/70 rounded-full"
                      style={{ height: `${Math.max(12, peak * 90)}%` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full text-center text-[10px] text-zinc-600">
                  No voiceover waveform loaded
                </div>
              )}
            </div>
          </div>

          {/* 4. Track 3: Subtitles / Captions */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>Subtitles & Speech Segments ({project.speechSegments.length})</span>
            </div>

            <div className="h-10 relative bg-zinc-900/60 rounded-lg overflow-hidden border border-zinc-800 flex">
              {project.speechSegments.map((seg, idx) => {
                const segDuration = seg.endTime - seg.startTime;
                const widthPercent = (segDuration / totalDuration) * 100;
                const isActive = currentTime >= seg.startTime && currentTime <= seg.endTime;

                return (
                  <div
                    key={seg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(seg.startTime);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSegId(seg.id);
                      setEditingText(seg.text);
                    }}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full relative shrink-0 border-r border-zinc-800/80 px-1.5 py-1 flex items-center justify-between cursor-pointer transition-all overflow-hidden ${
                      isActive
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-white'
                        : 'bg-zinc-900/90 hover:bg-zinc-800/80 text-zinc-300'
                    }`}
                    title={`Click to seek, double click to edit: "${seg.text}"`}
                  >
                    {editingSegId === seg.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => {
                          onUpdateSegment(seg.id, { text: editingText });
                          setEditingSegId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateSegment(seg.id, { text: editingText });
                            setEditingSegId(null);
                          }
                        }}
                        className="w-full text-[10px] bg-zinc-950 border border-emerald-500 rounded px-1 py-0.5 text-white focus:outline-none"
                      />
                    ) : (
                      <>
                        <span className="text-[10px] font-medium truncate">
                          {seg.text}
                        </span>
                        <span className="text-[8px] font-mono text-zinc-500 shrink-0 ml-1">
                          {segDuration.toFixed(1)}s
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
