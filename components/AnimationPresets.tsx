import React from 'react';
import { AVAILABLE_PRESETS } from '../utils/animationUtils';

interface AnimationPresetsProps {
  onPresetSelect: (preset: string) => void;
  activePreset: string | null;
  disabled: boolean;
}

export const AnimationPresets: React.FC<AnimationPresetsProps> = ({
  onPresetSelect,
  activePreset,
  disabled,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
          <span>Procedural SMIL Presets</span>
          <span className="text-xs text-slate-500 font-normal">(Instant client-side swap)</span>
        </h2>
      </div>
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {AVAILABLE_PRESETS.map((preset) => {
          const isActive = activePreset?.toLowerCase() === preset.toLowerCase();
          return (
            <button
              key={preset}
              onClick={() => onPresetSelect(preset)}
              disabled={disabled}
              className={`py-2 px-2.5 text-xs font-medium rounded-lg transition-all text-center border ${
                isActive
                  ? 'bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white hover:border-slate-600'
              } disabled:hover:bg-slate-800 disabled:cursor-not-allowed`}
            >
              {preset}
            </button>
          );
        })}
      </div>
    </div>
  );
};
