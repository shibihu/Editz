import React from 'react';
import { Type, Palette, ShieldAlert, Sliders } from 'lucide-react';
import { SubtitleStyle } from '../types';

interface SubtitleStylePanelProps {
  style: SubtitleStyle;
  onChange: (updated: SubtitleStyle) => void;
  onClose: () => void;
}

export const SubtitleStylePanel: React.FC<SubtitleStylePanelProps> = ({
  style,
  onChange,
  onClose,
}) => {
  const presets: { id: SubtitleStyle['preset']; name: string; preview: string; config: Partial<SubtitleStyle> }[] = [
    {
      id: 'tiktok-pop',
      name: 'TikTok Classic',
      preview: 'VIRAL HOOK',
      config: {
        preset: 'tiktok-pop',
        primaryColor: '#FFFFFF',
        highlightColor: '#FACC15', // Bright Yellow
        strokeColor: '#000000',
        strokeWidth: 8,
        uppercase: true,
        fontSize: 56,
      },
    },
    {
      id: 'bold-yellow',
      name: 'Yellow Punch',
      preview: 'PUNCHY TEXT',
      config: {
        preset: 'bold-yellow',
        primaryColor: '#FACC15',
        highlightColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 8,
        uppercase: true,
        fontSize: 60,
      },
    },
    {
      id: 'karaoke-glow',
      name: 'Neon Pop',
      preview: 'NEON GLOW',
      config: {
        preset: 'karaoke-glow',
        primaryColor: '#38BDF8', // Sky Blue
        highlightColor: '#4ADE80', // Neon Lime
        strokeColor: '#000000',
        strokeWidth: 8,
        uppercase: true,
        fontSize: 54,
      },
    },
    {
      id: 'minimal-clean',
      name: 'Clean Modern',
      preview: 'Minimal Clean',
      config: {
        preset: 'minimal-clean',
        primaryColor: '#F4F4F5',
        highlightColor: '#A855F7',
        strokeColor: '#18181B',
        strokeWidth: 6,
        uppercase: false,
        fontSize: 50,
      },
    },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 border-l border-zinc-800 p-4 overflow-y-auto custom-scrollbar text-zinc-200 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-zinc-100 text-sm">Subtitle Styling</h3>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white px-1.5 py-0.5 rounded text-sm"
        >
          ✕
        </button>
      </div>

      {/* Preset Selector */}
      <div className="mt-4">
        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Short-Form Presets:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => {
            const isSelected = style.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onChange({ ...style, ...p.config })}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-950/40 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <div
                  className="font-black text-sm mb-1 tracking-tight"
                  style={{
                    color: p.config.highlightColor || '#FFF',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {p.preview}
                </div>
                <div className="text-[10px] text-zinc-400">{p.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Size Slider */}
      <div className="mt-5 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider">Font Size</span>
          <span className="font-mono text-zinc-300">{style.fontSize}px</span>
        </div>
        <input
          type="range"
          min="36"
          max="80"
          step="2"
          value={style.fontSize}
          onChange={(e) => onChange({ ...style, fontSize: parseInt(e.target.value) })}
          className="w-full accent-purple-500 cursor-pointer"
        />
      </div>

      {/* Vertical Positioning (Y-Offset in %) */}
      <div className="mt-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider">
            Vertical Position (Safe Zone)
          </span>
          <span className="font-mono text-zinc-300">{style.yPosition}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="85"
          step="1"
          value={style.yPosition}
          onChange={(e) => onChange({ ...style, yPosition: parseInt(e.target.value) })}
          className="w-full accent-purple-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span>Center (50%)</span>
          <span>Lower-Center (72%)</span>
          <span>Bottom (85%)</span>
        </div>
      </div>

      {/* Color Customization */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800">
          <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">
            Primary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.primaryColor}
              onChange={(e) => onChange({ ...style, primaryColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[11px] text-zinc-300">{style.primaryColor}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800">
          <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">
            Highlight Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.highlightColor}
              onChange={(e) => onChange({ ...style, highlightColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[11px] text-zinc-300">{style.highlightColor}</span>
          </div>
        </div>
      </div>

      {/* All Caps Switch */}
      <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
        <div>
          <p className="text-xs font-semibold text-zinc-200">Uppercase All Words</p>
          <p className="text-[10px] text-zinc-500">Standard style for viral shorts and reels</p>
        </div>
        <button
          onClick={() => onChange({ ...style, uppercase: !style.uppercase })}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            style.uppercase ? 'bg-purple-600' : 'bg-zinc-800'
          }`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${
              style.uppercase ? 'left-5' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
