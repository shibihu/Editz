import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  ShieldAlert,
  Sparkles,
  Info,
  Sliders,
  Flame,
} from 'lucide-react';
import { EditProject, TimelineClip, SpeechSegment, SubtitleStyle } from '../types';
import { formatTime } from '../utils/mediaUtils';

interface VideoPlayerProps {
  project: EditProject;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSelectClip: (clip: TimelineClip) => void;
  selectedClip: TimelineClip | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlay,
  onSelectClip,
  selectedClip,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showReasoningModal, setShowReasoningModal] = useState(false);

  const totalDuration = project.totalDuration || (project.voiceover?.duration ?? 10);

  // Determine active clip on the timeline
  const activeClip = useMemo(() => {
    return (
      project.timelineClips.find(
        (c) => currentTime >= c.timelineStart && currentTime <= c.timelineEnd
      ) || project.timelineClips[0] || null
    );
  }, [project.timelineClips, currentTime]);

  // Determine active speech / subtitle segment
  const activeSegment = useMemo(() => {
    return (
      project.speechSegments.find(
        (s) => currentTime >= s.startTime && currentTime <= s.endTime
      ) || null
    );
  }, [project.speechSegments, currentTime]);

  // Find footage object corresponding to active clip
  const activeFootage = useMemo(() => {
    if (!activeClip) return null;
    return project.footages.find((f) => f.id === activeClip.footageId) || null;
  }, [project.footages, activeClip]);

  // Sync video source & seek position when activeClip or currentTime changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeFootage || !activeClip) return;

    const targetSrc = activeFootage.fileUrl;
    if (video.src !== targetSrc && !video.src.endsWith(targetSrc)) {
      video.src = targetSrc;
    }

    const clipOffset = Math.max(0, currentTime - activeClip.timelineStart);
    const targetVideoTime = (activeClip.trimStart || 0) + clipOffset * (activeClip.speed || 1);

    // Sync only if difference is noticeable (> 0.25s) to avoid micro stutter
    if (Math.abs(video.currentTime - targetVideoTime) > 0.25) {
      video.currentTime = Math.min(targetVideoTime, video.duration || 9999);
    }
  }, [activeClip, activeFootage, currentTime]);

  // Sync audio source & seek position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !project.voiceover) return;

    if (audio.src !== project.voiceover.fileUrl && !audio.src.endsWith(project.voiceover.fileUrl)) {
      audio.src = project.voiceover.fileUrl;
    }

    if (Math.abs(audio.currentTime - currentTime) > 0.25) {
      audio.currentTime = currentTime;
    }
  }, [project.voiceover, currentTime]);

  // Handle Play / Pause sync
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (isPlaying) {
      if (video) video.play().catch(() => {});
      if (audio) audio.play().catch(() => {});
    } else {
      if (video) video.pause();
      if (audio) audio.pause();
    }
  }, [isPlaying]);

  // Handle Spacebar to toggle play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay]);

  // Calculate styled subtitle words with active word highlight
  const renderedSubtitle = useMemo(() => {
    if (!activeSegment) return null;

    const style = project.subtitleStyle;
    const rawText = activeSegment.text;
    const displayText = style.uppercase ? rawText.toUpperCase() : rawText;

    // Check if word-level timing is available
    if (activeSegment.words && activeSegment.words.length > 0) {
      return (
        <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
          {activeSegment.words.map((w, idx) => {
            const isWordActive = currentTime >= w.start && currentTime <= w.end;
            const wordDisplay = style.uppercase ? w.word.toUpperCase() : w.word;
            return (
              <span
                key={idx}
                style={{
                  color: isWordActive ? style.highlightColor : style.primaryColor,
                  textShadow: `-2px -2px 0 ${style.strokeColor}, 2px -2px 0 ${style.strokeColor}, -2px 2px 0 ${style.strokeColor}, 2px 2px 0 ${style.strokeColor}, 0 4px 10px rgba(0,0,0,0.8)`,
                  transform: isWordActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.1s ease',
                  display: 'inline-block',
                }}
                className="font-black tracking-tight"
              >
                {wordDisplay}
              </span>
            );
          })}
        </span>
      );
    }

    // Default fallback: highlight first 1-2 words
    const words = displayText.split(/\s+/);
    return (
      <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        {words.map((word, idx) => {
          const isHighlighted = idx === 0;
          return (
            <span
              key={idx}
              style={{
                color: isHighlighted ? style.highlightColor : style.primaryColor,
                textShadow: `-2px -2px 0 ${style.strokeColor}, 2px -2px 0 ${style.strokeColor}, -2px 2px 0 ${style.strokeColor}, 2px 2px 0 ${style.strokeColor}, 0 4px 10px rgba(0,0,0,0.8)`,
              }}
              className="font-black tracking-tight"
            >
              {word}
            </span>
          );
        })}
      </span>
    );
  }, [activeSegment, currentTime, project.subtitleStyle]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-zinc-950/60 p-2 sm:p-4 relative">
      {/* Hidden audio element for voiceover playback */}
      <audio
        ref={audioRef}
        muted={isMuted}
        onEnded={() => onSeek(0)}
      />

      {/* 9:16 Vertical Video Screen Frame */}
      <div
        ref={containerRef}
        className="relative aspect-[9/16] w-auto h-[480px] sm:h-[530px] lg:h-[580px] max-h-[72vh] rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/80 border border-zinc-800 flex items-center justify-center group"
      >
        {/* Main Video Element */}
        {activeFootage ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-700 ${
              activeClip?.zoomMode === 'slow-zoom'
                ? 'scale-105'
                : activeClip?.zoomMode === 'fit'
                ? 'object-contain'
                : 'scale-100'
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-600 p-6 text-center">
            <Flame className="w-10 h-10 mb-2 opacity-40 text-amber-500 animate-pulse" />
            <p className="text-xs font-medium text-zinc-400">Ready to Edit</p>
            <p className="text-[11px] text-zinc-500 mt-1">Upload clips or load demo project</p>
          </div>
        )}

        {/* Dynamic Subtitle Overlay */}
        {renderedSubtitle && (
          <div
            className="absolute left-4 right-4 text-center pointer-events-none z-10 transition-all select-none"
            style={{
              top: `${project.subtitleStyle.yPosition || 72}%`,
              transform: 'translateY(-50%)',
              fontSize: `${Math.round((project.subtitleStyle.fontSize || 54) * 0.42)}px`,
              lineHeight: 1.15,
            }}
          >
            {renderedSubtitle}
          </div>
        )}

        {/* Hook Badge for the first 3 seconds */}
        {currentTime <= 3.2 && activeClip && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/90 text-black text-[11px] font-black uppercase tracking-wider shadow-lg animate-pulse backdrop-blur-sm">
            <Flame className="w-3.5 h-3.5 fill-black" />
            <span>0-3s Viral Hook</span>
          </div>
        )}

        {/* AI Selection Reason Pill on Video */}
        {activeClip && (
          <button
            onClick={() => {
              onSelectClip(activeClip);
              setShowReasoningModal(!showReasoningModal);
            }}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-700/80 text-zinc-200 text-xs backdrop-blur-md transition-all shadow-md group/pill"
            title="Click to view why AI matched this footage"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover/pill:text-indigo-300" />
            <span className="text-[11px] font-medium hidden sm:inline">Why this clip?</span>
          </button>
        )}

        {/* TikTok / Reels / Shorts Safe Area Guide Overlay */}
        {showSafeArea && (
          <div className="absolute inset-0 pointer-events-none z-15 border border-dashed border-cyan-400/50 p-4 flex flex-col justify-between">
            {/* Top Header Safe Boundary */}
            <div className="h-10 border-b border-cyan-400/30 flex items-center justify-between text-[10px] text-cyan-300 font-mono px-2">
              <span>Following | For You</span>
              <span>Search 🔍</span>
            </div>

            {/* Right Action Icons (Like, Comment, Bookmark, Share) */}
            <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 text-white/70 text-[10px] font-mono">
              <div className="w-8 h-8 rounded-full bg-black/40 border border-cyan-400/40 flex items-center justify-center">❤️</div>
              <div className="w-8 h-8 rounded-full bg-black/40 border border-cyan-400/40 flex items-center justify-center">💬</div>
              <div className="w-8 h-8 rounded-full bg-black/40 border border-cyan-400/40 flex items-center justify-center">🔖</div>
              <div className="w-8 h-8 rounded-full bg-black/40 border border-cyan-400/40 flex items-center justify-center">↗️</div>
            </div>

            {/* Bottom Caption Safe Margin */}
            <div className="h-16 border-t border-cyan-400/30 flex items-center text-[10px] text-cyan-300/80 font-mono px-2">
              <span>Safe Zone: Captions & Audio title area</span>
            </div>
          </div>
        )}

        {/* AI Reasoning Popover / Modal inside Preview */}
        {showReasoningModal && activeClip && (
          <div className="absolute inset-x-3 bottom-14 z-30 p-3.5 rounded-xl bg-zinc-950/95 border border-indigo-500/40 backdrop-blur-md shadow-2xl text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Footage Matching Intelligence</span>
              </div>
              <button
                onClick={() => setShowReasoningModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-200 mt-2 leading-relaxed">
              {activeClip.aiReasoning ||
                `Matched to spoken phrase "${activeClip.subtitleText}" based on semantic context and visual motion.`}
            </p>
            {activeFootage?.analysis && (
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-300">{activeFootage.name}</span>
                <span>·</span>
                <span>Hook Score: {activeFootage.analysis.hookScore}/10</span>
                <span>·</span>
                <span>{activeFootage.analysis.mood}</span>
              </div>
            )}
          </div>
        )}

        {/* Quick Play/Pause Center Tap Area */}
        <button
          onClick={onTogglePlay}
          className="absolute inset-0 z-5 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-950/80 border border-zinc-700/80 flex items-center justify-center text-white shadow-xl backdrop-blur-sm">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </div>
        </button>
      </div>

      {/* Mini Video Controls Bar Under Preview */}
      <div className="mt-3 w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-between gap-3 px-3 py-1.5 bg-zinc-900/80 rounded-xl border border-zinc-800 text-zinc-300 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onSeek(0)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Replay from start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-zinc-400 ml-1">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Safe Area Guides Toggle */}
          <button
            onClick={() => setShowSafeArea(!showSafeArea)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
              showSafeArea
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Toggle TikTok / Shorts / Reels safe area overlay"
          >
            <ShieldAlert className="w-3 h-3" />
            <span className="hidden sm:inline">Safe Area</span>
          </button>

          {/* Mute / Unmute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
