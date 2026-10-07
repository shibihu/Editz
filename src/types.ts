export interface FootageAnalysis {
  description: string;
  tags: string[];
  motionIntensity: 'low' | 'medium' | 'high';
  mood: string;
  hookScore: number; // 1 to 10
  keyVisualElements: string[];
}

export interface Footage {
  id: string;
  name: string;
  file?: File;
  fileUrl: string; // Object URL or public URL
  serverPath?: string; // Path on server if uploaded
  duration: number; // seconds
  width: number;
  height: number;
  aspectRatio: string; // e.g. "9:16", "16:9", "1:1"
  fps: number;
  thumbnailUrl: string; // Base64 or object URL
  analysis?: FootageAnalysis;
  isAnalyzing?: boolean;
}

export interface VoiceoverData {
  file?: File;
  fileUrl: string;
  serverPath?: string;
  fileName: string;
  duration: number;
  waveform: number[]; // Normalized peaks [0..1]
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface SpeechSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: WordTiming[];
  isHook?: boolean;
}

export interface TimelineClip {
  id: string;
  footageId: string;
  timelineStart: number; // Start time on overall video timeline
  timelineEnd: number; // End time on overall video timeline
  duration: number;
  trimStart: number; // In-point inside the source footage
  trimEnd: number; // Out-point inside the source footage
  speed: number;
  zoomMode: 'fit' | 'fill-center' | 'slow-zoom' | 'pan';
  aiReasoning: string; // "Selected because narration mentions X..."
  subtitleText: string;
}

export interface SubtitleStyle {
  preset: 'tiktok-pop' | 'bold-yellow' | 'karaoke-glow' | 'minimal-clean';
  fontSize: number; // px on 1080x1920 (e.g. 54)
  primaryColor: string; // Hex e.g. #FFFFFF
  highlightColor: string; // Hex e.g. #FACC15 (Yellow)
  strokeColor: string; // Hex e.g. #000000
  strokeWidth: number; // px (e.g. 8)
  yPosition: number; // Percentage from top (e.g. 72%)
  uppercase: boolean;
  showSafeArea: boolean;
}

export interface EditProject {
  id: string;
  title: string;
  footages: Footage[];
  voiceover: VoiceoverData | null;
  transcript: string;
  speechSegments: SpeechSegment[];
  timelineClips: TimelineClip[];
  subtitleStyle: SubtitleStyle;
  isProcessing: boolean;
  processingStep: string;
  totalDuration: number;
}
