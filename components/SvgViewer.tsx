import React, { useState, useMemo } from 'react';
import { sanitizeSvg, validateSvg } from '../utils/svgSecurity';

interface SvgViewerProps {
  svgCode: string;
}

export const SvgViewer: React.FC<SvgViewerProps> = ({ svgCode }) => {
  const [bgStyle, setBgStyle] = useState<'dark' | 'grid' | 'light'>('grid');
  const [scale, setScale] = useState<number>(1);

  const sanitized = useMemo(() => sanitizeSvg(svgCode), [svgCode]);
  const validation = useMemo(() => validateSvg(sanitized), [sanitized]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  return (
    <div className="w-full h-full flex flex-col relative group">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 p-1 rounded-lg text-xs shadow-lg backdrop-blur-md">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border-r border-slate-700 pr-1 mr-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-1.5 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-[11px] text-slate-400 font-mono"
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom In"
          >
            +
          </button>
        </div>

        {/* Background style toggle */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setBgStyle('grid')}
            className={`px-2 py-0.5 rounded ${
              bgStyle === 'grid'
                ? 'bg-cyan-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Checkerboard transparency grid"
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setBgStyle('dark')}
            className={`px-2 py-0.5 rounded ${
              bgStyle === 'dark'
                ? 'bg-cyan-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Dark canvas background"
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setBgStyle('light')}
            className={`px-2 py-0.5 rounded ${
              bgStyle === 'light'
                ? 'bg-cyan-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Light canvas background"
          >
            Light
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className={`w-full min-h-[340px] sm:min-h-[380px] flex-grow flex items-center justify-center p-6 rounded-lg transition-colors overflow-hidden ${
          bgStyle === 'grid'
            ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950/80'
            : bgStyle === 'light'
            ? 'bg-slate-100 text-slate-900'
            : 'bg-slate-950 text-slate-100'
        }`}
      >
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
          className="max-w-full max-h-[380px] w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-[380px] [&>svg]:w-auto [&>svg]:h-auto [&>svg]:object-contain"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </div>

      {/* Bounding / ViewBox Meta Indicator */}
      {validation.viewBox && (
        <div className="absolute bottom-2 left-2 z-10 text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800 font-mono flex items-center gap-2">
          <span>viewBox: {validation.viewBox.width}×{validation.viewBox.height}</span>
          {validation.hasAnimations && (
            <span className="text-cyan-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              SMIL Active
            </span>
          )}
        </div>
      )}
    </div>
  );
};
