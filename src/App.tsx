import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Film,
  Sparkles,
  Sliders,
  Type,
  Layers,
  FolderOpen,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  EditProject,
  Footage,
  VoiceoverData,
  SpeechSegment,
  TimelineClip,
  SubtitleStyle,
} from './types';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { UploadSection } from './components/UploadSection';
import { Timeline } from './components/Timeline';
import { ClipInspector } from './components/ClipInspector';
import { SubtitleStylePanel } from './components/SubtitleStylePanel';
import { ExportModal } from './components/ExportModal';

const initialSubtitleStyle: SubtitleStyle = {
  preset: 'tiktok-pop',
  fontSize: 56,
  primaryColor: '#FFFFFF',
  highlightColor: '#FACC15', // Vibrant TikTok yellow
  strokeColor: '#000000',
  strokeWidth: 8,
  yPosition: 72,
  uppercase: true,
  showSafeArea: false,
};

const initialProject: EditProject = {
  id: 'proj_default',
  title: 'Untitled Viral Short',
  footages: [],
  voiceover: null,
  transcript: '',
  speechSegments: [],
  timelineClips: [],
  subtitleStyle: initialSubtitleStyle,
  isProcessing: false,
  processingStep: '',
  totalDuration: 10,
};

export default function App() {
  const [project, setProject] = useState<EditProject>(initialProject);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClip, setSelectedClip] = useState<TimelineClip | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'inspector' | 'subtitles'>('media');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Playhead animation loop when playing
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + delta;
        const total = project.totalDuration || (project.voiceover?.duration ?? 10);
        if (next >= total) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, project.totalDuration, project.voiceover]);

  // Handle Seek
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle Toggle Play
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Footage Management
  const handleFootageAdd = (newFootages: Footage[]) => {
    setProject((prev) => ({
      ...prev,
      footages: [...prev.footages, ...newFootages],
    }));
    showToast(`Added ${newFootages.length} video clip(s) to footage library.`);
  };

  const handleFootageRemove = (id: string) => {
    setProject((prev) => ({
      ...prev,
      footages: prev.footages.filter((f) => f.id !== id),
      timelineClips: prev.timelineClips.filter((c) => c.footageId !== id),
    }));
  };

  // Voiceover Management
  const handleVoiceoverSet = (voiceover: VoiceoverData) => {
    setProject((prev) => ({
      ...prev,
      voiceover,
      totalDuration: voiceover.duration,
    }));
    showToast(`Loaded voiceover "${voiceover.fileName}" (${voiceover.duration.toFixed(1)}s).`);
  };

  // Transcript Management
  const handleTranscriptChange = (text: string) => {
    setProject((prev) => ({ ...prev, transcript: text }));
  };

  // Load Pre-packaged Sample Project
  const handleLoadSampleProject = async () => {
    setIsLoadingSample(true);
    setProject((prev) => ({
      ...prev,
      isProcessing: true,
      processingStep: 'Loading demo assets & AI voiceover...',
    }));

    try {
      const resp = await fetch('/api/sample-project');
      const data = await resp.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load sample project');
      }

      // Generate waveform for the sample audio
      const audioUrl = data.audio.fileUrl;
      let waveform = Array.from({ length: 60 }, (_, i) =>
        0.2 + 0.6 * Math.abs(Math.sin(i * 0.3) * Math.cos(i * 0.15))
      );

      const sampleVoiceover: VoiceoverData = {
        fileUrl: audioUrl,
        serverPath: data.audio.serverPath,
        fileName: data.audio.fileName,
        duration: data.audio.duration || 11.5,
        waveform,
      };

      const updatedProject: EditProject = {
        ...project,
        title: 'Future of Computing Short',
        footages: data.footages,
        voiceover: sampleVoiceover,
        transcript: data.script,
        totalDuration: sampleVoiceover.duration,
        isProcessing: true,
        processingStep: 'Transcribing & aligning speech segments with Gemini...',
      };
      setProject(updatedProject);

      // Now automatically run Auto-Edit on the sample data!
      await executeAutoEdit(updatedProject);
      showToast('Loaded demo project with 4 video footages and AI voiceover!');
    } catch (err: any) {
      console.error('Failed to load sample project:', err);
      showToast(`Error: ${err.message || 'Could not load sample project'}`);
      setProject((prev) => ({ ...prev, isProcessing: false, processingStep: '' }));
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Core AI Auto-Edit Pipeline Execution
  const executeAutoEdit = async (projState: EditProject) => {
    setProject((prev) => ({
      ...prev,
      isProcessing: true,
      processingStep: 'Step 1/3: Analyzing speech cadence and sentence boundaries...',
    }));

    try {
      // 1. Transcribe / Align Speech Segments
      let segments = projState.speechSegments;
      if (segments.length === 0 || projState.transcript) {
        const transRes = await fetch('/api/transcribe-voiceover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: projState.transcript,
            duration: projState.voiceover?.duration || 10,
          }),
        });
        const transData = await transRes.json();
        if (transData.success && Array.isArray(transData.segments) && transData.segments.length > 0) {
          segments = transData.segments;
        }
      }

      if (segments.length === 0) {
        // Fallback default segments if transcription returned empty
        const dur = projState.voiceover?.duration || 10;
        segments = [
          {
            id: 'seg_1',
            text: 'Discover the extraordinary future of intelligence',
            startTime: 0.0,
            endTime: dur * 0.35,
            isHook: true,
          },
          {
            id: 'seg_2',
            text: 'Processing trillions of computations every second',
            startTime: dur * 0.35,
            endTime: dur * 0.7,
            isHook: false,
          },
          {
            id: 'seg_3',
            text: 'The future is already unfolding right now',
            startTime: dur * 0.7,
            endTime: dur,
            isHook: false,
          },
        ];
      }

      setProject((prev) => ({
        ...prev,
        speechSegments: segments,
        processingStep: 'Step 2/3: Semantic footage matching & hook optimization...',
      }));

      // 2. Auto-match footage using Gemini 3.8 Flash
      const editRes = await fetch('/api/auto-match-and-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          footages: projState.footages,
          speechSegments: segments,
          pacing: 'fast',
        }),
      });

      const editData = await editRes.json();
      if (!editData.success || !Array.isArray(editData.timelineClips)) {
        throw new Error(editData.error || 'Failed to generate timeline clips');
      }

      const timelineClips: TimelineClip[] = editData.timelineClips;

      setProject((prev) => ({
        ...prev,
        speechSegments: segments,
        timelineClips,
        isProcessing: false,
        processingStep: '',
      }));

      if (timelineClips.length > 0) {
        setSelectedClip(timelineClips[0]);
        setActiveTab('inspector');
      }

      showToast(`Generated ${timelineClips.length} AI-matched cuts with 0-3s hook optimization!`);
    } catch (err: any) {
      console.error('Auto-edit execution error:', err);
      showToast(`Error: ${err.message || 'Auto-edit failed'}`);
      setProject((prev) => ({ ...prev, isProcessing: false, processingStep: '' }));
    }
  };

  // Run Auto-Edit Trigger
  const handleRunAutoEdit = () => {
    executeAutoEdit(project);
  };

  // Timeline Clip Updates (trim, swap, framing)
  const handleUpdateClip = (clipId: string, updates: Partial<TimelineClip>) => {
    setProject((prev) => {
      const updatedClips = prev.timelineClips.map((c) =>
        c.id === clipId ? { ...c, ...updates } : c
      );
      return { ...prev, timelineClips: updatedClips };
    });

    if (selectedClip && selectedClip.id === clipId) {
      setSelectedClip((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  // Speech Segment Updates (subtitle text, timing)
  const handleUpdateSegment = (segId: string, updates: Partial<SpeechSegment>) => {
    setProject((prev) => ({
      ...prev,
      speechSegments: prev.speechSegments.map((s) =>
        s.id === segId ? { ...s, ...updates } : s
      ),
    }));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        project={project}
        onLoadSample={handleLoadSampleProject}
        onRegenerate={handleRunAutoEdit}
        onOpenExport={() => setShowExportModal(true)}
        isLoadingSample={isLoadingSample}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-xs text-zinc-200 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Workstation Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center Area: 9:16 Preview Player */}
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950/70 p-2 sm:p-4 border-b lg:border-b-0 lg:border-r border-zinc-800/80 overflow-hidden relative">
          <VideoPlayer
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            onTogglePlay={handleTogglePlay}
            onSelectClip={(c) => {
              setSelectedClip(c);
              setActiveTab('inspector');
            }}
            selectedClip={selectedClip}
          />
        </div>

        {/* Right Sidebar: Tabs for Media Upload, Clip Inspector, Subtitle Styling */}
        <div className="w-full lg:w-[460px] xl:w-[500px] h-full flex flex-col bg-zinc-900/60 shrink-0 border-l border-zinc-800/60 overflow-hidden">
          {/* Sidebar Tab Header */}
          <div className="flex items-center border-b border-zinc-800 px-3 bg-zinc-950/50">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'media'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Media & Script</span>
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'inspector'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Clip AI Intelligence</span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'subtitles'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-purple-400" />
              <span>Subtitle Styles</span>
            </button>
          </div>

          {/* Sidebar Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'media' && (
              <UploadSection
                project={project}
                onFootageAdd={handleFootageAdd}
                onFootageRemove={handleFootageRemove}
                onVoiceoverSet={handleVoiceoverSet}
                onTranscriptChange={handleTranscriptChange}
                onRunAutoEdit={handleRunAutoEdit}
                isProcessing={project.isProcessing}
                processingStep={project.processingStep}
              />
            )}

            {activeTab === 'inspector' && selectedClip && (
              <ClipInspector
                clip={selectedClip}
                project={project}
                onUpdateClip={handleUpdateClip}
                onClose={() => setActiveTab('media')}
              />
            )}

            {activeTab === 'inspector' && !selectedClip && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <Layers className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs font-medium text-zinc-400">No Clip Selected</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Click any clip on the bottom timeline to inspect AI reasoning, adjust framing, or swap footage.
                </p>
              </div>
            )}

            {activeTab === 'subtitles' && (
              <SubtitleStylePanel
                style={project.subtitleStyle}
                onChange={(s) => setProject((prev) => ({ ...prev, subtitleStyle: s }))}
                onClose={() => setActiveTab('media')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Interactive Multi-Track Timeline */}
      <Timeline
        project={project}
        currentTime={currentTime}
        onSeek={handleSeek}
        selectedClip={selectedClip}
        onSelectClip={(c) => {
          setSelectedClip(c);
          setActiveTab('inspector');
        }}
        onUpdateClip={handleUpdateClip}
        onUpdateSegment={handleUpdateSegment}
      />

      {/* Full HD 1080x1920 MP4 Export Modal */}
      {showExportModal && (
        <ExportModal
          project={project}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
