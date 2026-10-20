import React, { useState } from 'react';
import {
  ProviderId,
  ModelDefinition,
  SUPPORTED_MODELS,
  ProviderSettings,
} from '../services/modelProviders';

interface ModelSelectorProps {
  selectedProvider: ProviderId;
  selectedModel: string;
  onProviderChange: (provider: ProviderId) => void;
  onModelChange: (model: string) => void;
  settings: ProviderSettings;
  onSettingsChange: (settings: ProviderSettings) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  settings,
  onSettingsChange,
  temperature,
  onTemperatureChange,
  disabled = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const availableModels = SUPPORTED_MODELS.filter((m) => m.provider === selectedProvider);
  const activeModelDef =
    SUPPORTED_MODELS.find((m) => m.id === selectedModel) || availableModels[0];

  const handleProviderSelect = (provider: ProviderId) => {
    onProviderChange(provider);
    const firstModelOfProvider = SUPPORTED_MODELS.find((m) => m.provider === provider);
    if (firstModelOfProvider) {
      onModelChange(firstModelOfProvider.id);
    }
  };

  const getProviderIcon = (provider: ProviderId) => {
    switch (provider) {
      case 'anthropic':
        return '🧠';
      case 'google':
        return '✨';
      case 'openai':
        return '⚡';
      case 'ollama':
        return '🦙';
    }
  };

  const getProviderLabel = (provider: ProviderId) => {
    switch (provider) {
      case 'anthropic':
        return 'Anthropic Claude';
      case 'google':
        return 'Google Gemini';
      case 'openai':
        return 'OpenAI';
      case 'ollama':
        return 'Local / Ollama';
    }
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
      {/* Provider Selector Tabs */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Multimodal AI Engine
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['anthropic', 'google', 'openai', 'ollama'] as ProviderId[]).map((p) => {
            const isSelected = selectedProvider === p;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => handleProviderSelect(p)}
                className={`py-1.5 px-2.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                } disabled:opacity-50`}
              >
                <span>{getProviderIcon(p)}</span>
                <span className="truncate">{getProviderLabel(p).split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Selection Dropdown */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex-1">
          <label className="text-xs text-slate-400 block mb-1">Active Model</label>
          <select
            value={selectedModel}
            disabled={disabled}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs sm:text-sm py-2 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.badge ? `(${m.badge})` : ''} — {m.maxTokens.toLocaleString()} tokens
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="self-end sm:self-auto mt-2 sm:mt-5 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800/80 transition-colors"
        >
          <span>⚙️</span>
          <span>{showAdvanced ? 'Hide Config' : 'Model Settings'}</span>
        </button>
      </div>

      {/* Model Description & Capabilities Badge */}
      {activeModelDef && (
        <div className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80 flex items-start justify-between gap-2">
          <span>{activeModelDef.description}</span>
          <span className="shrink-0 font-mono text-[11px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            {activeModelDef.maxTokens} max tokens
          </span>
        </div>
      )}

      {/* Advanced Provider Configuration Panel */}
      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3 bg-slate-900/40 p-3 rounded-lg">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-300 font-medium">
                {selectedProvider === 'anthropic'
                  ? 'Anthropic API Key'
                  : selectedProvider === 'google'
                  ? 'Gemini API Key'
                  : selectedProvider === 'openai'
                  ? 'OpenAI API Key'
                  : 'Ollama Authorization / API Key (optional)'}
              </label>
              {selectedProvider === 'anthropic' && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Key Active
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder={
                selectedProvider === 'anthropic'
                  ? 'sk-ant-usr-...'
                  : selectedProvider === 'google'
                  ? 'AIzaSy...'
                  : selectedProvider === 'openai'
                  ? 'sk-proj-...'
                  : 'ollama / optional'
              }
              value={settings.apiKey || ''}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg text-xs py-1.5 px-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Keys are securely stored in your browser session and used for direct API communication.
            </p>
          </div>

          {/* Custom Base URL (especially for Ollama or custom proxies) */}
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              {selectedProvider === 'ollama' ? 'Ollama / vLLM Base URL' : 'Custom Base URL / Proxy (optional)'}
            </label>
            <input
              type="text"
              placeholder={
                selectedProvider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'https://api.anthropic.com/v1'
              }
              value={settings.baseUrl || ''}
              onChange={(e) => onSettingsChange({ ...settings, baseUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg text-xs py-1.5 px-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
              <span>Sampling Temperature: {selectedProvider === 'anthropic' ? 'Auto (Calibrated)' : temperature}</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {selectedProvider === 'anthropic'
                  ? 'Auto-Managed by Claude 5.5'
                  : temperature <= 0.2
                  ? 'Deterministic & Precise Geometry'
                  : 'More Stylistic Creativity'}
              </span>
            </div>
            {selectedProvider !== 'anthropic' && (
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
