import React from 'react';
import { SceneLayer, SceneDecompositionPlan } from '../services/sceneDecomposer';

interface LayerManagerProps {
  plan: SceneDecompositionPlan | null;
  activeLayerId: string | null;
  onToggleLayerVisibility: (layerId: string) => void;
  onSelectLayer: (layerId: string) => void;
  onRegenerateLayer?: (layerId: string) => void;
  isDecomposing: boolean;
  isLayerGenerating: boolean;
  currentGeneratingLayerName?: string;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  plan,
  activeLayerId,
  onToggleLayerVisibility,
  onSelectLayer,
  onRegenerateLayer,
  isDecomposing,
  isLayerGenerating,
  currentGeneratingLayerName,
}) => {
  if (!plan && !isDecomposing) return null;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Decomposed Scene Layers</span>
            <span className="text-[11px] font-normal text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-full">
              Divide & Stitch Mode
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {plan?.sceneTitle || 'Decomposing scene into distinct visual elements...'}
          </p>
        </div>

        {plan && (
          <span className="text-xs font-mono text-slate-500">
            {plan.layers.filter((l) => l.status === 'completed').length}/{plan.layers.length} Ready
          </span>
        )}
      </div>

      {/* Progress Notification Bar */}
      {(isDecomposing || isLayerGenerating) && (
        <div className="bg-cyan-950/40 border border-cyan-800/80 rounded-lg p-3 text-xs text-cyan-300 flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <span className="font-semibold">
              {isDecomposing
                ? 'Step 1/2: Semantic Visual Decomposition in progress...'
                : `Synthesizing ${currentGeneratingLayerName || 'Layer'} with dedicated token budget...`}
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              Allocating full VLM attention to character anatomy, contours, and gradients
            </span>
          </div>
        </div>
      )}

      {/* Layer List Cards */}
      <div className="space-y-2 mt-2">
        {plan?.layers.map((layer) => {
          const isSelected = activeLayerId === layer.id;
          const isCompleted = layer.status === 'completed';
          const isWorking = layer.status === 'generating';

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Visibility Checkbox */}
                <button
                  type="button"
                  title={layer.visible ? 'Hide layer from stitched preview' : 'Show layer in stitched preview'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLayerVisibility(layer.id);
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                    layer.visible
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {layer.visible ? '👁' : '✕'}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {layer.name}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      z:{layer.zIndex} &bull; {layer.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {layer.description || layer.focusedPrompt}
                  </p>
                </div>
              </div>

              {/* Status / Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isWorking && (
                  <span className="text-[11px] text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    Rendering...
                  </span>
                )}
                {isCompleted && (
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                    <span>✓</span> Ready
                  </span>
                )}
                {layer.status === 'failed' && (
                  <span className="text-[11px] text-rose-400 font-mono">Failed</span>
                )}

                {isCompleted && onRegenerateLayer && (
                  <button
                    type="button"
                    title="Regenerate only this layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerateLayer(layer.id);
                    }}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-700/60"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
