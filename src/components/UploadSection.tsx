import React, { useState, useRef } from 'react';
import {
  Upload,
  Video,
  Mic,
  FileText,
  Sparkles,
  Trash2,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  Loader2,
  Music,
} from 'lucide-react';
import { Footage, VoiceoverData, EditProject } from '../types';
import { extractVideoMetadata, extractAudioWaveform, formatBytes } from '../utils/mediaUtils';

interface UploadSectionProps {
  project: EditProject;
  onFootageAdd: (footages: Footage[]) => void;
  onFootageRemove: (id: string) => void;
  onVoiceoverSet: (voiceover: VoiceoverData) => void;
  onTranscriptChange: (text: string) => void;
  onRunAutoEdit: () => void;
  isProcessing: boolean;
  processingStep: string;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  project,
  onFootageAdd,
  onFootageRemove,
  onVoiceoverSet,
  onTranscriptChange,
  onRunAutoEdit,
  isProcessing,
  processingStep,
}) => {
  const footageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingFootage, setIsDraggingFootage] = useState(false);
  const [isUploadingFootage, setIsUploadingFootage] = useState(false);
  const [autoTranscribe, setAutoTranscribe] = useState(false);

  // Handle Video Footage Files
  const handleFootageFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingFootage(true);

    const newFootages: Footage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('video/')) continue;

      try {
        const id = `footage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const localUrl = URL.createObjectURL(file);

        // Client-side extraction of thumbnail, duration, resolution
        const meta = await extractVideoMetadata(file);

        // Upload file to server in background
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();

        // Call Gemini to analyze visual content
        let analysisData = undefined;
        try {
          const analyzeRes = await fetch('/api/analyze-footage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              duration: meta.duration,
              width: meta.width,
              height: meta.height,
              thumbnailBase64: meta.thumbnailUrl,
            }),
          });
          const aJson = await analyzeRes.json();
          if (aJson.success) {
            analysisData = aJson.analysis;
          }
        } catch (e) {
          console.warn('AI analysis failed, using fallback:', e);
        }

        newFootages.push({
          id,
          name: file.name,
          file,
          fileUrl: uploadData.fileUrl || localUrl,
          serverPath: uploadData.serverPath,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          aspectRatio: meta.aspectRatio,
          fps: 30,
          thumbnailUrl: meta.thumbnailUrl,
          analysis: analysisData,
          isAnalyzing: false,
        });
      } catch (err) {
        console.error('Error processing footage file:', file.name, err);
      }
    }

    if (newFootages.length > 0) {
      onFootageAdd(newFootages);
    }
    setIsUploadingFootage(false);
  };

  // Handle Voiceover Audio File
  const handleAudioFile = async (file: File) => {
    if (!file || !file.type.startsWith('audio/')) return;

    try {
      const localUrl = URL.createObjectURL(file);
      const { duration, waveform } = await extractAudioWaveform(file);

      // Upload audio to server
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload-media', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      onVoiceoverSet({
        file,
        fileUrl: uploadData.fileUrl || localUrl,
        serverPath: uploadData.serverPath,
        fileName: file.name,
        duration,
        waveform,
      });
    } catch (err) {
      console.error('Error loading audio:', err);
    }
  };

  // Handle Transcript File (.txt, .srt)
  const handleScriptFile = async (file: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      onTranscriptChange(text);
    } catch (err) {
      console.error('Error reading script file:', err);
    }
  };

  const canAnalyze =
    project.footages.length > 0 &&
    (project.voiceover !== null || project.transcript.trim().length > 0);

  return (
    <div className="flex flex-col gap-4 p-4 text-zinc-200">
      {/* 3 Main Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Upload Video Footage */}
        <div className="flex flex-col rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>1. Video Footage ({project.footages.length})</span>
            </div>
            <button
              onClick={() => footageInputRef.current?.click()}
              className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add Files
            </button>
          </div>

          <input
            ref={footageInputRef}
            type="file"
            multiple
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFootageFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFootage(true);
            }}
            onDragLeave={() => setIsDraggingFootage(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFootage(false);
              if (e.dataTransfer.files) handleFootageFiles(e.dataTransfer.files);
            }}
            onClick={() => footageInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[96px] ${
              isDraggingFootage
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-zinc-700/60 hover:border-zinc-600 bg-zinc-950/40'
            }`}
          >
            {isUploadingFootage ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-xs text-zinc-400">Processing & Analyzing Frames...</span>
              </div>
            ) : (
              <>
                <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                <span className="text-xs font-medium text-zinc-300">Drop multiple video files</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">MP4, MOV, WebM (Horizontal or Vertical)</span>
              </>
            )}
          </div>

          {/* Footage List Thumbnails */}
          {project.footages.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
              {project.footages.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 group text-left"
                >
                  <img
                    src={f.thumbnailUrl}
                    alt={f.name}
                    className="w-12 h-12 object-cover rounded bg-black shrink-0 border border-zinc-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{f.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                      <span>{f.duration.toFixed(1)}s</span>
                      <span>·</span>
                      <span>{f.aspectRatio}</span>
                      {f.analysis?.hookScore && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> {f.analysis.hookScore}/10
                          </span>
                        </>
                      )}
                    </div>
                    {f.analysis?.description && (
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {f.analysis.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFootageRemove(f.id);
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Remove footage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Upload AI Voiceover Audio */}
        <div className="flex flex-col rounded-xl bg-zinc-900/90 border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
              <Mic className="w-4 h-4 text-purple-400" />
              <span>2. AI Voiceover Audio</span>
            </div>
            {project.voiceover && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            )}
          </div>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleAudioFile(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {project.voiceover ? (
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate max-w-[150px]">
                      {project.voiceover.fileName}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Duration: {project.voiceover.duration.toFixed(1)}s
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  Replace
                </button>
              </div>

              {/* Waveform Visualization preview */}
              <div className="h-8 w-full flex items-center gap-0.5 bg-black/40 px-2 rounded border border-zinc-800/80">
                {project.voiceover.waveform.map((peak, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-purple-400/80 rounded-full"
                    style={{ height: `${Math.max(15, peak * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              onClick={() => audioInputRef.current?.click()}
              className="border border-dashed border-zinc-700/60 hover:border-zinc-600 rounded-lg p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[96px] bg-zinc-950/40"
            >
              <Mic className="w-5 h-5 text-zinc-400 mb-1" />
              <span className="text-xs font-medium text-zinc-300">Upload voiceover audio</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">MP3, WAV, AAC (AI Narration)</span>
            </div>
          )}
        </div>

        {/* 3. Paste / Upload Transcript */}
        <div className="flex flex-col rounded-xl bg-zinc-900/90 border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>3. Script / Subtitles</span>
            </div>
            <button
              onClick={() => scriptInputRef.current?.click()}
              className="text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              Upload .txt
            </button>
          </div>

          <input
            ref={scriptInputRef}
            type="file"
            accept=".txt,.srt,.vtt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleScriptFile(e.target.files[0]);
              e.target.value = '';
            }}
          />

          <textarea
            value={project.transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder="Paste your voiceover script or transcript here. (Optional: Leave blank for Gemini AI auto-transcription)..."
            rows={4}
            className="w-full text-xs bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/80 resize-none font-sans"
          />

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{project.transcript.trim().split(/\s+/).filter(Boolean).length} words</span>
            <span>Auto-syncs to voiceover beats</span>
          </div>
        </div>
      </div>

      {/* Primary Action Button: Analyze & Auto-Edit */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-zinc-900/80 border border-indigo-500/30">
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-100">
              AI Smart Footage Matching & 9:16 Vertical Edit
            </p>
            <p className="text-[11px] text-zinc-400">
              Gemini analyzes speech beats, optimizes the 0-3s hook, and matches footage to spoken narration.
            </p>
          </div>
        </div>

        <button
          onClick={onRunAutoEdit}
          disabled={!canAnalyze || isProcessing}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{processingStep || 'Processing...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Analyze & Auto-Edit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
