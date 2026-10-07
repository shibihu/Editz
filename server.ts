import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Working directories for media processing
const UPLOAD_DIR = path.join('/tmp', 'shortscraft_uploads');
const EXPORT_DIR = path.join('/tmp', 'shortscraft_exports');
const SAMPLE_DIR = path.join('/tmp', 'shortscraft_samples');

[UPLOAD_DIR, EXPORT_DIR, SAMPLE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB limit
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded and exported files statically
app.use('/media/uploads', express.static(UPLOAD_DIR));
app.use('/media/exports', express.static(EXPORT_DIR));
app.use('/media/samples', express.static(SAMPLE_DIR));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Resilient Gemini caller using fast 3.1-flash-lite with fallback
 */
async function callGeminiWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const model = params.preferredModel || 'gemini-3.1-flash-lite';
  try {
    return await ai.models.generateContent({
      model,
      contents: params.contents,
      config: params.config,
    });
  } catch (err: any) {
    console.warn(`Model ${model} failed (${err?.message}), falling back to gemini-flash-latest`);
    return await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: params.contents,
      config: params.config,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* API: Upload Media File                                                     */
/* -------------------------------------------------------------------------- */
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/media/uploads/${req.file.filename}`;
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    serverPath: req.file.path,
    fileUrl,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

/* -------------------------------------------------------------------------- */
/* API: Analyze Footage with Gemini 3.8 Flash                                 */
/* -------------------------------------------------------------------------- */
app.post('/api/analyze-footage', async (req, res) => {
  try {
    const { name, duration, width, height, thumbnailBase64 } = req.body;

    const parts: any[] = [];
    if (thumbnailBase64 && typeof thumbnailBase64 === 'string') {
      const cleanBase64 = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    parts.push({
      text: `You are an elite short-form video editor for TikTok, YouTube Shorts, and Instagram Reels.
Analyze this video footage frame and metadata:
- Footage Name: "${name}"
- Duration: ${duration || 'unknown'} seconds
- Dimensions: ${width || 1920}x${height || 1080}

Evaluate what is happening visually. Return a JSON object with:
{
  "description": "Clear 1-2 sentence visual summary of what happens on screen",
  "tags": ["3 to 6 descriptive tags about subjects, lighting, mood, action"],
  "motionIntensity": "low" | "medium" | "high",
  "mood": "e.g. Energetic, Cyberpunk, Cinematic, Dramatic, Informational, Serene",
  "hookScore": number from 1 to 10 (10 = irresistible high-impact hook for the critical first 1-3 seconds),
  "keyVisualElements": ["list of 3 key objects or visual cues visible"]
}`,
    });

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const analysis = JSON.parse(text);

    res.json({
      success: true,
      analysis: {
        description: analysis.description || 'Dynamic video footage capture.',
        tags: Array.isArray(analysis.tags) ? analysis.tags : ['b-roll', 'action'],
        motionIntensity: analysis.motionIntensity || 'medium',
        mood: analysis.mood || 'Cinematic',
        hookScore: typeof analysis.hookScore === 'number' ? analysis.hookScore : 6,
        keyVisualElements: Array.isArray(analysis.keyVisualElements)
          ? analysis.keyVisualElements
          : ['subject', 'background'],
      },
    });
  } catch (err: any) {
    console.error('Error in analyze-footage:', err);
    res.status(500).json({ error: err.message || 'Footage analysis failed' });
  }
});

/* -------------------------------------------------------------------------- */
/* API: Transcribe Voiceover & Align Timestamps                               */
/* -------------------------------------------------------------------------- */
app.post('/api/transcribe-voiceover', async (req, res) => {
  try {
    const { transcript, duration, audioBase64 } = req.body;
    const dur = Number(duration) || 15;

    let prompt = '';
    const parts: any[] = [];

    if (transcript && transcript.trim()) {
      prompt = `You are an audio subtitle synchronization engine for TikTok/Shorts.
The user provided this voiceover narration transcript:
"""
${transcript.trim()}
"""
The total voiceover duration is ${dur.toFixed(2)} seconds.

Synchronize and segment this transcript into short, punchy, mobile-friendly subtitle chunks (typically 2 to 5 words per chunk or short clauses).
Estimate realistic start and end timestamps in seconds spanning 0.0s to ${dur.toFixed(2)}s.
Ensure:
1. Long sentences are split into short 1-2 line readable chunks.
2. Words have start and end timestamps.
3. First 3.0 seconds are flagged with isHook: true.
4. No overlaps between segments.

Return JSON:
{
  "segments": [
    {
      "id": "seg_1",
      "text": "First punchy line",
      "startTime": 0.0,
      "endTime": 1.6,
      "isHook": true,
      "words": [
        { "word": "First", "start": 0.0, "end": 0.5 },
        { "word": "punchy", "start": 0.5, "end": 1.1 },
        { "word": "line", "start": 1.1, "end": 1.6 }
      ]
    }
  ]
}`;
      parts.push({ text: prompt });
    } else {
      // Auto-transcribe mode
      prompt = `You are a speech transcription engine for short-form videos.
The total voiceover duration is ${dur.toFixed(2)} seconds.
Transcribe the speech and segment it into punchy short-form subtitle chunks with start and end timestamps from 0.0s to ${dur.toFixed(2)}s.
Split long thoughts into 2-5 word chunks. Include word-level breakdown. First 3 seconds flagged with isHook: true.

Return JSON:
{
  "segments": [
    {
      "id": "seg_1",
      "text": "Transcribed phrase",
      "startTime": 0.0,
      "endTime": 1.5,
      "isHook": true,
      "words": [
        { "word": "Transcribed", "start": 0.0, "end": 0.7 },
        { "word": "phrase", "start": 0.7, "end": 1.5 }
      ]
    }
  ]
}`;
      if (audioBase64) {
        const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'audio/mp3',
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: prompt });
    }

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const segments = Array.isArray(parsed.segments) ? parsed.segments : [];

    res.json({ success: true, segments });
  } catch (err: any) {
    console.error('Error in transcribe-voiceover:', err);
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

/* -------------------------------------------------------------------------- */
/* API: Auto Match Footage & Generate Timeline                                */
/* -------------------------------------------------------------------------- */
app.post('/api/auto-match-and-edit', async (req, res) => {
  try {
    const { footages, speechSegments, pacing = 'fast' } = req.body;

    if (!Array.isArray(footages) || footages.length === 0) {
      return res.status(400).json({ error: 'No footage provided' });
    }
    if (!Array.isArray(speechSegments) || speechSegments.length === 0) {
      return res.status(400).json({ error: 'No speech segments provided' });
    }

    const footageSummaries = footages.map((f: any, idx: number) => ({
      index: idx + 1,
      id: f.id,
      name: f.name,
      duration: f.duration || 5,
      aspectRatio: f.aspectRatio || '16:9',
      description: f.analysis?.description || f.name,
      tags: f.analysis?.tags || [],
      mood: f.analysis?.mood || 'Neutral',
      motionIntensity: f.analysis?.motionIntensity || 'medium',
      hookScore: f.analysis?.hookScore || 5,
    }));

    const segmentsSummary = speechSegments.map((s: any, idx: number) => ({
      index: idx + 1,
      id: s.id,
      text: s.text,
      startTime: Number(s.startTime.toFixed(2)),
      endTime: Number(s.endTime.toFixed(2)),
      duration: Number((s.endTime - s.startTime).toFixed(2)),
      isHook: !!s.isHook,
    }));

    const prompt = `You are a world-class AI short-form vertical video editor (specialized in TikTok, YouTube Shorts, Instagram Reels).
Your mission is to construct an engaging 9:16 vertical video timeline by pairing footage clips with spoken voiceover segments.

FOOTAGE REPOSITORY:
${JSON.stringify(footageSummaries, null, 2)}

SPOKEN NARRATION SEGMENTS:
${JSON.stringify(segmentsSummary, null, 2)}

PACING PREFERENCE: ${pacing}

CORE EDITING RULES:
1. HOOK OPTIMIZATION: For the first 1 to 3 seconds (opening hook), you MUST choose the footage with the highest visual impact and hook score that relates to the opening hook statement. Hook retention is priority #1!
2. SEMANTIC VISUAL MATCHING: Analyze the meaning, metaphors, and subjects of each spoken sentence. Select footage that adds visual interest and clarifies the narration rather than merely being generic wallpaper.
3. AVOID REPETITION: Do not use the exact same footage in consecutive cuts if other relevant clips are available. Rotate visual variety.
4. IN-POINT TRIMMING: Ensure 'trimStart' + 'duration' <= footage duration. If clip needs 2s, choose an action-packed in-point (e.g. trimStart: 0.5, trimEnd: 2.5).
5. REASONING EXPLANATION: For EVERY single timeline clip, write a concise, compelling explanation of why you selected this clip (e.g. "Selected because narration highlights lightning speed and this clip features electric neon pulses with fast kinetic motion.").
6. 9:16 VERTICAL REFRAMING: Specify 'zoomMode':
   - "fill-center": Standard center crop to 9:16 vertical
   - "slow-zoom": Subtle cinematic push-in (ideal for emotional punchlines or hooks)
   - "pan": Subtle horizontal slide for landscape vistas
   - "fit": Contain with blur backdrop

Return a JSON object in this exact schema:
{
  "timelineClips": [
    {
      "id": "clip_1",
      "footageId": "matching_footage_id",
      "timelineStart": 0.0,
      "timelineEnd": 2.1,
      "duration": 2.1,
      "trimStart": 0.0,
      "trimEnd": 2.1,
      "speed": 1.0,
      "zoomMode": "slow-zoom",
      "aiReasoning": "Selected because narration says ... and this footage contains ...",
      "subtitleText": "First spoken line"
    }
  ]
}`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const timelineClips = Array.isArray(parsed.timelineClips)
      ? parsed.timelineClips
      : [];

    res.json({ success: true, timelineClips });
  } catch (err: any) {
    console.error('Error in auto-match-and-edit:', err);
    res.status(500).json({ error: err.message || 'Auto-edit matching failed' });
  }
});

/* -------------------------------------------------------------------------- */
/* API: Generate Sample Voiceover TTS using gemini-3.8-flash-lite-tts         */
/* -------------------------------------------------------------------------- */
app.post('/api/generate-sample-tts', async (req, res) => {
  try {
    const text =
      req.body.text ||
      "Artificial intelligence is transforming computing forever! Neural networks now process trillions of operations every second. From satellites orbiting Earth to quantum chips at the atomic scale, the future isn't coming—it is already here!";

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: 'High-energy, engaging viral short-form narrator with clear punchy delivery',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('No audio returned from TTS model');
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    const audioFilename = `sample_voiceover_${Date.now()}.wav`;
    const audioPath = path.join(SAMPLE_DIR, audioFilename);
    fs.writeFileSync(audioPath, wavBuffer);

    res.json({
      success: true,
      audioUrl: `/media/samples/${audioFilename}`,
      serverPath: audioPath,
      text,
    });
  } catch (err: any) {
    console.error('Error generating sample TTS:', err);
    res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
});

/* -------------------------------------------------------------------------- */
/* API: Pre-packaged Sample Project Data                                      */
/* -------------------------------------------------------------------------- */
app.get('/api/sample-project', async (_req, res) => {
  try {
    // Generate 4 rich sample video clips with FFmpeg if they don't already exist
    const samples = [
      {
        id: 'sample_clip_1',
        filename: 'sample_cyber_core.mp4',
        name: 'Neural AI Core & Hologram',
        filter:
          'testsrc=size=1080x1920:rate=30,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf:text=\'AI NEURAL CORE\':fontcolor=white:fontsize=70:x=(w-text_w)/2:y=300:box=1:boxcolor=black@0.6:boxborderw=20',
        duration: 6,
        description: 'Futuristic glowing neural network grid with neon cyan energy pulses and high-speed motion.',
        tags: ['neural-network', 'cyberpunk', 'ai', 'high-energy'],
        motionIntensity: 'high',
        mood: 'Futuristic',
        hookScore: 9,
        keyVisualElements: ['neural pulses', 'cyan laser grid', 'digital data'],
      },
      {
        id: 'sample_clip_2',
        filename: 'sample_earth_orbit.mp4',
        name: 'Earth Orbit & Satellite Network',
        filter:
          'testsrc=size=1080x1920:rate=30,hue=s=2:h=120,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf:text=\'ORBITAL SATELLITES\':fontcolor=yellow:fontsize=70:x=(w-text_w)/2:y=300:box=1:boxcolor=black@0.6:boxborderw=20',
        duration: 5,
        description: 'Vibrant orbital perspective showing swirling global networks and atmospheric radiance.',
        tags: ['earth', 'space', 'satellites', 'global'],
        motionIntensity: 'medium',
        mood: 'Majestic',
        hookScore: 7,
        keyVisualElements: ['Earth curve', 'satellite beams', 'atmosphere'],
      },
      {
        id: 'sample_clip_3',
        filename: 'sample_quantum_chip.mp4',
        name: 'Quantum Microprocessor Architecture',
        filter:
          'smptebars=size=1080x1920:rate=30,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf:text=\'QUANTUM PROCESSOR\':fontcolor=cyan:fontsize=70:x=(w-text_w)/2:y=300:box=1:boxcolor=black@0.6:boxborderw=20',
        duration: 6,
        description: 'Extreme macro zoom on silicon microchip circuitry with lightning-fast electrons flowing.',
        tags: ['quantum', 'microchip', 'hardware', 'nanotech'],
        motionIntensity: 'high',
        mood: 'Technical',
        hookScore: 8,
        keyVisualElements: ['silicon paths', 'gold pins', 'electron flash'],
      },
      {
        id: 'sample_clip_4',
        filename: 'sample_data_stream.mp4',
        name: 'Fiber Optic Highway & Data Wave',
        filter:
          'testsrc2=size=1080x1920:rate=30,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf:text=\'DATA HIGHWAY\':fontcolor=magenta:fontsize=70:x=(w-text_w)/2:y=300:box=1:boxcolor=black@0.6:boxborderw=20',
        duration: 6,
        description: 'Blazing speed fiber optic streams conveying terabits of real-time cloud computing.',
        tags: ['fiber-optics', 'speed', 'cloud-infrastructure', 'networking'],
        motionIntensity: 'high',
        mood: 'Kinetic',
        hookScore: 8,
        keyVisualElements: ['light streaks', 'optical beams', 'speed blur'],
      },
    ];

    // Generate clips if missing
    for (const item of samples) {
      const filePath = path.join(SAMPLE_DIR, item.filename);
      if (!fs.existsSync(filePath)) {
        try {
          await execFileAsync('ffmpeg', [
            '-y',
            '-f',
            'lavfi',
            '-i',
            item.filter,
            '-t',
            item.duration.toString(),
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-preset',
            'ultrafast',
            filePath,
          ]);
        } catch (e) {
          console.warn(`Could not generate sample clip ${item.filename}:`, e);
        }
      }
    }

    // Generate sample audio voiceover if missing
    const sampleAudioFile = path.join(SAMPLE_DIR, 'sample_narrator.wav');
    const sampleScript =
      "Artificial intelligence is transforming computing forever! Neural networks now process trillions of operations every second. From satellites orbiting Earth to quantum chips at the atomic scale, the future isn't coming—it is already here!";

    if (!fs.existsSync(sampleAudioFile)) {
      try {
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: sampleScript,
                  speechMetadata: {
                    style: 'Energetic, fast-paced viral YouTube shorts creator voice',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' },
              },
            },
          },
        });
        const b64 =
          ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (b64) {
          fs.writeFileSync(sampleAudioFile, Buffer.from(b64, 'base64'));
        }
      } catch (ttsErr) {
        // Fallback: generate a silent/tone audio clip using FFmpeg if offline
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'anoisesrc=d=11:c=pink:r=24000:a=0.05',
          sampleAudioFile,
        ]);
      }
    }

    // Extract duration of sample audio if possible
    let audioDuration = 11.5;
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        sampleAudioFile,
      ]);
      const parsedDur = parseFloat(stdout.trim());
      if (!isNaN(parsedDur) && parsedDur > 0) {
        audioDuration = parsedDur;
      }
    } catch (_) {}

    res.json({
      success: true,
      script: sampleScript,
      audio: {
        fileUrl: '/media/samples/sample_narrator.wav',
        serverPath: sampleAudioFile,
        fileName: 'sample_narrator.wav',
        duration: audioDuration,
      },
      footages: samples.map((s) => ({
        id: s.id,
        name: s.name,
        fileUrl: `/media/samples/${s.filename}`,
        serverPath: path.join(SAMPLE_DIR, s.filename),
        duration: s.duration,
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        fps: 30,
        thumbnailUrl: `/media/samples/${s.filename}`,
        analysis: {
          description: s.description,
          tags: s.tags,
          motionIntensity: s.motionIntensity,
          mood: s.mood,
          hookScore: s.hookScore,
          keyVisualElements: s.keyVisualElements,
        },
      })),
    });
  } catch (err: any) {
    console.error('Error loading sample project:', err);
    res.status(500).json({ error: err.message || 'Sample project setup failed' });
  }
});

/* -------------------------------------------------------------------------- */
/* API: Export Real 1080x1920 9:16 H.264 MP4 with Burned Subtitles            */
/* -------------------------------------------------------------------------- */
app.post('/api/render-export', async (req, res) => {
  const exportId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const workDir = path.join(EXPORT_DIR, exportId);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const { timelineClips, footages, voiceover, speechSegments, subtitleStyle } =
      req.body;

    if (!Array.isArray(timelineClips) || timelineClips.length === 0) {
      return res.status(400).json({ error: 'No timeline clips to export' });
    }

    const footageMap = new Map<string, any>();
    footages.forEach((f: any) => footageMap.set(f.id, f));

    // 1. Prepare ASS Subtitle File for pixel-perfect stylized captions
    const assFilePath = path.join(workDir, 'subtitles.ass');
    const primaryColor = subtitleStyle?.primaryColor || '#FFFFFF';
    const highlightColor = subtitleStyle?.highlightColor || '#FACC15';
    const strokeColor = subtitleStyle?.strokeColor || '#000000';
    const fontSize = subtitleStyle?.fontSize || 62;
    const yMargin = Math.round(1920 * ((subtitleStyle?.yPosition || 72) / 100));

    // Convert hex to ASS color format (&HAABBGGRR)
    const hexToAss = (hex: string, alpha = '00') => {
      const clean = hex.replace('#', '');
      const r = clean.substring(0, 2);
      const g = clean.substring(2, 4);
      const b = clean.substring(4, 6);
      return `&H${alpha}${b}${g}${r}&`;
    };

    const assHeader = `[Script Info]
Title: ShortsCraft Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TikTok,Liberation Sans,${fontSize},${hexToAss(primaryColor)},&H000000FF,${hexToAss(strokeColor)},&H80000000,-1,0,0,0,100,100,1,0,1,7,4,2,80,80,${1920 - yMargin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Format timestamps to ASS time: H:MM:SS.CC
    const toAssTime = (seconds: number) => {
      const s = Math.max(0, seconds);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const cs = Math.floor((s % 1) * 100);
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
    };

    let assEvents = '';
    const uppercase = subtitleStyle?.uppercase !== false;

    if (Array.isArray(speechSegments) && speechSegments.length > 0) {
      speechSegments.forEach((seg: any) => {
        let text = (seg.text || '').trim();
        if (uppercase) text = text.toUpperCase();

        // Highlight first 1-2 words in highlight color
        const words = text.split(/\s+/);
        let styledText = text;
        if (words.length > 1) {
          const firstWord = words[0];
          const rest = words.slice(1).join(' ');
          styledText = `{\\c${hexToAss(highlightColor)}}${firstWord}{\\c${hexToAss(primaryColor)}} ${rest}`;
        }

        assEvents += `Dialogue: 0,${toAssTime(seg.startTime)},${toAssTime(seg.endTime)},TikTok,,0,0,0,,${styledText}\n`;
      });
    }

    fs.writeFileSync(assFilePath, assHeader + assEvents);

    // 2. Render each timeline clip cropped & scaled to 1080x1920
    const clipOutputs: string[] = [];
    for (let i = 0; i < timelineClips.length; i++) {
      const clip = timelineClips[i];
      const footage = footageMap.get(clip.footageId);
      if (!footage) continue;

      let srcPath = footage.serverPath;
      if (!srcPath || !fs.existsSync(srcPath)) {
        // Fallback: check uploads
        const uploadCandidate = path.join(UPLOAD_DIR, path.basename(footage.fileUrl || ''));
        if (fs.existsSync(uploadCandidate)) {
          srcPath = uploadCandidate;
        } else {
          const sampleCandidate = path.join(SAMPLE_DIR, path.basename(footage.fileUrl || ''));
          if (fs.existsSync(sampleCandidate)) {
            srcPath = sampleCandidate;
          }
        }
      }

      if (!srcPath || !fs.existsSync(srcPath)) {
        console.warn(`Source path for footage ${clip.footageId} not found, generating colored block`);
        srcPath = path.join(workDir, `fallback_${i}.mp4`);
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=0x1e293b:s=1080x1920:d=${clip.duration}:r=30`,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          srcPath,
        ]);
      }

      const clipOut = path.join(workDir, `segment_${i}.mp4`);
      const trimStart = Math.max(0, clip.trimStart || 0);
      const duration = Math.max(0.2, clip.duration || 2);

      // FFmpeg filter: scale to cover 1080x1920 then center crop
      const filter =
        'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2,setsar=1';

      await execFileAsync('ffmpeg', [
        '-y',
        '-ss',
        trimStart.toFixed(2),
        '-t',
        duration.toFixed(2),
        '-i',
        srcPath,
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '20',
        '-an',
        clipOut,
      ]);

      clipOutputs.push(clipOut);
    }

    if (clipOutputs.length === 0) {
      throw new Error('No valid clips could be processed');
    }

    // 3. Concatenate video clips via concat demuxer
    const concatListPath = path.join(workDir, 'concat_list.txt');
    const concatContent = clipOutputs.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const mergedVideoPath = path.join(workDir, 'merged_video.mp4');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-c',
      'copy',
      mergedVideoPath,
    ]);

    // 4. Resolve Voiceover Audio File
    let audioSrc = voiceover?.serverPath;
    if (!audioSrc || !fs.existsSync(audioSrc)) {
      const cand1 = path.join(UPLOAD_DIR, path.basename(voiceover?.fileUrl || ''));
      const cand2 = path.join(SAMPLE_DIR, path.basename(voiceover?.fileUrl || ''));
      if (fs.existsSync(cand1)) audioSrc = cand1;
      else if (fs.existsSync(cand2)) audioSrc = cand2;
    }

    // 5. Final Compose: Burn ASS subtitles + Mix Voiceover Audio
    const finalMp4Filename = `short_${Date.now()}.mp4`;
    const finalMp4Path = path.join(EXPORT_DIR, finalMp4Filename);

    const ffmpegArgs: string[] = ['-y', '-i', mergedVideoPath];

    if (audioSrc && fs.existsSync(audioSrc)) {
      ffmpegArgs.push('-i', audioSrc);
    } else {
      // Provide silent audio track
      ffmpegArgs.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }

    // Subtitle burn-in filter
    ffmpegArgs.push(
      '-vf',
      `ass=${assFilePath}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-shortest',
      finalMp4Path
    );

    await execFileAsync('ffmpeg', ffmpegArgs);

    res.json({
      success: true,
      downloadUrl: `/media/exports/${finalMp4Filename}`,
      filename: finalMp4Filename,
      resolution: '1080x1920',
      aspectRatio: '9:16',
      format: 'H.264 / AAC MP4',
    });
  } catch (err: any) {
    console.error('Error in render-export:', err);
    res.status(500).json({ error: err.message || 'Render export failed' });
  } finally {
    // Cleanup temporary intermediate segment files after export
    setTimeout(() => {
      try {
        if (fs.existsSync(workDir)) {
          fs.rmSync(workDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }, 10000);
  }
});

/* -------------------------------------------------------------------------- */
/* Mount Vite dev middleware or serve static production build                 */
/* -------------------------------------------------------------------------- */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`ShortsCraft AI Video Editor server running on http://localhost:${PORT}`);
  });
}

startServer();
