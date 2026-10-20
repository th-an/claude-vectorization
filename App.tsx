import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { SvgViewer } from './components/SvgViewer';
import { Loader } from './components/Loader';
import { ModelSelector } from './components/ModelSelector';
import { LayerManager } from './components/LayerManager';
import {
  ProviderId,
  ProviderSettings,
  TokenUsage,
  generateSvgUnified,
  computeCostUsd,
  SUPPORTED_MODELS,
} from './services/modelProviders';
import {
  SceneDecompositionPlan,
  SceneLayer,
  planSceneDecomposition,
  synthesizeSingleLayer,
  stitchSceneLayers,
} from './services/sceneDecomposer';
import {
  startGenerationLog,
  logIteration,
  finalizeGenerationLog,
  getLatestGenerationLog,
  createFallbackLogFromSvg,
  detectVectorMethods,
  analyzeSvgMarkup,
  GenerationLog,
} from './services/generationLogger';
import { generateAndDownloadReportPdf } from './services/pdfReportGenerator';
import { processImageForVlm } from './utils/fileUtils';
import { applyAnimation } from './utils/animationUtils';
import { extractSvg, sanitizeSvg } from './utils/svgSecurity';
import { CopyIcon, DownloadIcon, CheckIcon, SparklesIcon, GoogleIcon } from './components/icons';
import { AnimationPresets } from './components/AnimationPresets';

type GenerationMode = 'image' | 'text';
type SynthesisStrategy = 'decompose' | 'single';

const SAMPLE_PROMPTS = [
  'A workstation pair programming scene with female developer and friendly robot companion',
  'A cute animated robotic astronaut floating in space with blinking helmet lights',
  'A modern gradient technology badge with pulsing circuit board lines',
  'Cyberpunk retro sun with sweeping grid lines and smooth floating parallax',
];

const LOCAL_STORAGE_SETTINGS_KEY = 'svg_animator_provider_settings_v2';
const LOCAL_STORAGE_PROVIDER_KEY = 'svg_animator_selected_provider_v2';
const LOCAL_STORAGE_MODEL_KEY = 'svg_animator_selected_model_v2';

const App: React.FC = () => {
  const [mode, setMode] = useState<GenerationMode>('image');
  const [strategy, setStrategy] = useState<SynthesisStrategy>('decompose');
  const [images, setImages] = useState<File[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [originalSvgCode, setOriginalSvgCode] = useState<string>('');
  const [svgCode, setSvgCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);

  // Telemetry Audit & PDF Report Generation State
  const [currentLog, setCurrentLog] = useState<GenerationLog | null>(() => getLatestGenerationLog());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Multi-Layer Decompose & Stitch State
  const [scenePlan, setScenePlan] = useState<SceneDecompositionPlan | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isDecomposing, setIsDecomposing] = useState<boolean>(false);
  const [isLayerGenerating, setIsLayerGenerating] = useState<boolean>(false);
  const [currentGeneratingLayerName, setCurrentGeneratingLayerName] = useState<string | undefined>(undefined);

  // Multimodal Model Provider State — Defaults to Claude Sonnet 5.5
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_PROVIDER_KEY) as ProviderId) || 'anthropic';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_MODEL_KEY) || 'claude-sonnet-5-5';
  });
  const [settings, setSettings] = useState<ProviderSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      apiKey: (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : '') || '',
    };
  });
  const [temperature, setTemperature] = useState<number>(0.2);

  // Sync settings with localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_MODEL_KEY, selectedModel);
  }, [selectedModel]);

  const handleSettingsChange = (newSettings: ProviderSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  };

  /**
   * Toggles visibility of a specific layer in the stitched SVG
   */
  const handleToggleLayerVisibility = useCallback((layerId: string) => {
    if (!scenePlan) return;
    const updatedLayers = scenePlan.layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    const updatedPlan = { ...scenePlan, layers: updatedLayers };
    setScenePlan(updatedPlan);

    const reStitched = stitchSceneLayers(updatedPlan, updatedLayers);
    setSvgCode(reStitched);
    setOriginalSvgCode(reStitched);
  }, [scenePlan]);

  /**
   * Re-synthesizes a single layer without re-generating the entire scene
   */
  const handleRegenerateLayer = useCallback(async (layerId: string) => {
    if (!scenePlan) return;
    const targetLayer = scenePlan.layers.find((l) => l.id === layerId);
    if (!targetLayer) return;

    setIsLayerGenerating(true);
    setCurrentGeneratingLayerName(targetLayer.name);
    setError(null);

    try {
      let imageParts: { mimeType: string; data: string }[] = [];
      if (mode === 'image') {
        imageParts = await Promise.all(
          images.map(async (file) => {
            const processed = await processImageForVlm(file);
            return { mimeType: processed.mimeType, data: processed.data };
          })
        );
      }

      const layerRes = await synthesizeSingleLayer(
        targetLayer,
        scenePlan,
        imageParts,
        selectedProvider,
        selectedModel,
        settings
      );

      const updatedLayers = scenePlan.layers.map((l) =>
        l.id === layerId ? { ...l, svgMarkup: layerRes.svgMarkup, usage: layerRes.usage, status: 'completed' as const } : l
      );
      const updatedPlan = { ...scenePlan, layers: updatedLayers };
      setScenePlan(updatedPlan);

      const reStitched = stitchSceneLayers(updatedPlan, updatedLayers);
      setSvgCode(reStitched);
      setOriginalSvgCode(reStitched);
    } catch (e) {
      console.error('Layer regeneration error:', e);
      setError(e instanceof Error ? e.message : 'Failed to regenerate layer');
    } finally {
      setIsLayerGenerating(false);
      setCurrentGeneratingLayerName(undefined);
    }
  }, [scenePlan, images, mode, selectedProvider, selectedModel, settings]);

  /**
   * Master Generation Orchestrator:
   * Supports both 'decompose' (multi-layer divide-and-stitch) and 'single' (direct single-shot)
   */
  const handleGeneration = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please provide a prompt describing the SVG you want.');
      return;
    }
    if (mode === 'image' && images.length === 0) {
      setError('Please upload at least one image to analyze in Image + Text mode.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setActivePreset(null);
    setLastUsage(null);

    // Initialize Telemetry Audit Logger
    startGenerationLog({
      title: prompt.trim().slice(0, 50),
      prompt: prompt.trim(),
      provider: selectedProvider,
      model: selectedModel,
      strategy,
      inputImagesCount: images.length,
    });

    try {
      let imageParts: { mimeType: string; data: string }[] = [];
      if (mode === 'image') {
        imageParts = await Promise.all(
          images.map(async (file) => {
            const processed = await processImageForVlm(file);
            return {
              mimeType: processed.mimeType,
              data: processed.data,
            };
          })
        );
      }

      // STRATEGY A: DECOMPOSE & STITCH (HIGH PRECISION CHARACTER FIDELITY)
      if (strategy === 'decompose') {
        setIsDecomposing(true);
        setScenePlan(null);

        // Stage 1: Plan Scene Semantic Layers
        const planStartTime = Date.now();
        const plan = await planSceneDecomposition(
          prompt.trim(),
          imageParts,
          selectedProvider,
          selectedModel,
          settings
        );
        const planDuration = Date.now() - planStartTime;
        setScenePlan(plan);
        setIsDecomposing(false);

        logIteration({
          name: 'Scene Architecture & Decomposition Blueprint',
          role: 'planner',
          durationMs: planDuration,
          promptSnippet: `Breakdown into ${plan.layers.length} z-ordered semantic layers`,
          tokens: plan.planningUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          vectorMethods: ['JSON Schema Decomposition', 'Centroid ViewBox Calculation'],
          pathCount: 0,
          status: 'success',
        });

        // Stage 2: Sequentially synthesize each layer with focused token budget
        setIsLayerGenerating(true);
        const currentLayers: SceneLayer[] = [...plan.layers];

        for (let i = 0; i < currentLayers.length; i++) {
          const currentLayer = currentLayers[i];
          setCurrentGeneratingLayerName(currentLayer.name);
          currentLayers[i] = { ...currentLayer, status: 'generating' };
          setScenePlan({ ...plan, layers: [...currentLayers] });

          const layerStartTime = Date.now();
          try {
            const layerRes = await synthesizeSingleLayer(
              currentLayer,
              plan,
              imageParts,
              selectedProvider,
              selectedModel,
              settings
            );

            const layerDuration = Date.now() - layerStartTime;
            const methods = detectVectorMethods(layerRes.svgMarkup);
            const pathMatches = (layerRes.svgMarkup.match(/<path\b/gi) || []).length;

            logIteration({
              name: `Layer Synthesis: ${currentLayer.name}`,
              role: currentLayer.role,
              durationMs: layerDuration,
              promptSnippet: currentLayer.focusedPrompt.slice(0, 100),
              tokens: layerRes.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              vectorMethods: methods,
              pathCount: pathMatches,
              status: 'success',
            });

            currentLayers[i] = {
              ...currentLayer,
              status: 'completed',
              svgMarkup: layerRes.svgMarkup,
              usage: layerRes.usage,
              visible: true,
            };

            // Progressive real-time canvas stitching
            const partialStitched = stitchSceneLayers(plan, currentLayers);
            if (partialStitched) {
              setSvgCode(partialStitched);
              setOriginalSvgCode(partialStitched);
            }
          } catch (layerErr) {
            console.error(`Failed to generate layer ${currentLayer.name}:`, layerErr);
            const layerDuration = Date.now() - layerStartTime;
            logIteration({
              name: `Layer Synthesis: ${currentLayer.name}`,
              role: currentLayer.role,
              durationMs: layerDuration,
              promptSnippet: currentLayer.focusedPrompt.slice(0, 100),
              tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              vectorMethods: [],
              pathCount: 0,
              status: 'failed',
              error: layerErr instanceof Error ? layerErr.message : 'Layer generation error',
            });

            currentLayers[i] = {
              ...currentLayer,
              status: 'failed',
              error: layerErr instanceof Error ? layerErr.message : 'Layer generation error',
            };
          }

          setScenePlan({ ...plan, layers: [...currentLayers] });
        }

        setIsLayerGenerating(false);
        setCurrentGeneratingLayerName(undefined);

        // Aggregate total token consumption across decomposition plan + all layers
        let totalIn = plan.planningUsage?.inputTokens || 0;
        let totalOut = plan.planningUsage?.outputTokens || 0;
        let totalCached = plan.planningUsage?.cachedTokens || 0;
        let totalThinking = plan.planningUsage?.thinkingTokens || 0;

        currentLayers.forEach((l) => {
          if (l.usage) {
            totalIn += l.usage.inputTokens || 0;
            totalOut += l.usage.outputTokens || 0;
            totalCached += l.usage.cachedTokens || 0;
            totalThinking += l.usage.thinkingTokens || 0;
          }
        });

        const accumulatedUsage: TokenUsage = {
          inputTokens: totalIn,
          outputTokens: totalOut,
          cachedTokens: totalCached,
          thinkingTokens: totalThinking,
          totalTokens: totalIn + totalOut,
          costUsd: computeCostUsd(selectedModel, {
            inputTokens: totalIn,
            outputTokens: totalOut,
            cachedTokens: totalCached,
          }),
        };

        setLastUsage(accumulatedUsage);

        // Final assemble
        const finalStitched = stitchSceneLayers(plan, currentLayers);
        if (!finalStitched.startsWith('<svg')) {
          throw new Error('Decomposed scene layers could not be stitched into a valid SVG.');
        }

        const safeStitched = sanitizeSvg(finalStitched);
        setSvgCode(safeStitched);
        setOriginalSvgCode(safeStitched);

        // Finalize telemetry log and save
        try {
          const completedLog = finalizeGenerationLog(safeStitched, activePreset || undefined);
          setCurrentLog(completedLog);
        } catch (logErr) {
          console.warn('Error finalizing generation log:', logErr);
        }
        return;
      }

      // STRATEGY B: SINGLE-SHOT SCENE
      const singleStartTime = Date.now();
      const response = await generateSvgUnified({
        provider: selectedProvider,
        model: selectedModel,
        prompt: prompt.trim(),
        images: imageParts,
        settings,
        temperature,
      });
      const singleDuration = Date.now() - singleStartTime;

      if (response.usage) {
        setLastUsage(response.usage);
      }

      const cleanSvg = extractSvg(response.svgText);
      if (!cleanSvg.startsWith('<svg')) {
        throw new Error(
          'AI response did not contain a valid SVG tag. Try refining your prompt or selecting a different model.'
        );
      }

      const safeSvg = sanitizeSvg(cleanSvg);
      const methods = detectVectorMethods(safeSvg);
      const pathCount = (safeSvg.match(/<path\b/gi) || []).length;

      logIteration({
        name: 'Monolithic Direct Vector Synthesis',
        role: 'single-shot',
        durationMs: singleDuration,
        promptSnippet: prompt.trim().slice(0, 100),
        tokens: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        vectorMethods: methods,
        pathCount,
        status: 'success',
      });

      setSvgCode(safeSvg);
      setOriginalSvgCode(safeSvg);
      setScenePlan(null);

      // Finalize telemetry log and save
      try {
        const completedLog = finalizeGenerationLog(safeSvg, activePreset || undefined);
        setCurrentLog(completedLog);
      } catch (logErr) {
        console.warn('Error finalizing generation log:', logErr);
      }
    } catch (e: unknown) {
      console.error('Generation error:', e);
      const msg = e instanceof Error ? e.message : 'Failed to generate SVG. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsDecomposing(false);
      setIsLayerGenerating(false);
      setCurrentGeneratingLayerName(undefined);
    }
  }, [images, prompt, mode, strategy, selectedProvider, selectedModel, settings, temperature]);

  const handleGenerateGoogleIcon = useCallback(() => {
    const googlePrompt = "A clean, minimalist SVG of the Google 'G' logo, animated to spin horizontally like a coin.";

    const animatedGoogleIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 262" width="100%" height="100%">
    <g transform="translate(128, 131)">
        <g>
            <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; -1 1; 1 1"
                keyTimes="0; 0.5; 1"
                dur="1.5s"
                repeatCount="indefinite"
            />
            <g transform="translate(-128, -131)">
                <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.686H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.682.268c24.659-22.774 38.875-56.282 38.875-96.027z"/>
                <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.34 226.437 79.028 261.1 130.55 261.1z"/>
                <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.8-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782z"/>
                <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.028 0 35.34 34.663 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251z"/>
            </g>
        </g>
    </g>
</svg>
    `.trim();

    setMode('text');
    setImages([]);
    setPrompt(googlePrompt);
    setError(null);
    setSvgCode(animatedGoogleIconSvg);
    setOriginalSvgCode(animatedGoogleIconSvg);
    setActivePreset(null);
    setScenePlan(null);
    setIsLoading(false);

    // Provide default generation log for the Google sample icon
    const sampleLog = createFallbackLogFromSvg({
      svgCode: animatedGoogleIconSvg,
      prompt: googlePrompt,
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
    setCurrentLog(sampleLog);
  }, []);

  const handleApplyPreset = useCallback(
    (preset: string) => {
      if (!originalSvgCode) return;
      try {
        const animatedCode = applyAnimation(originalSvgCode, preset);
        setSvgCode(animatedCode);
        setActivePreset(preset);
        if (currentLog) {
          const updatedLog: GenerationLog = {
            ...currentLog,
            finalSvgMarkup: animatedCode,
            svgStats: analyzeSvgMarkup(animatedCode, preset),
          };
          setCurrentLog(updatedLog);
        }
      } catch (e) {
        console.error(e);
        setError('Failed to apply animation preset.');
      }
    },
    [originalSvgCode, currentLog]
  );

  const handleResetToOriginal = useCallback(() => {
    if (originalSvgCode) {
      setSvgCode(originalSvgCode);
      setActivePreset(null);
      if (currentLog) {
        const updatedLog: GenerationLog = {
          ...currentLog,
          finalSvgMarkup: originalSvgCode,
          svgStats: analyzeSvgMarkup(originalSvgCode),
        };
        setCurrentLog(updatedLog);
      }
    }
  }, [originalSvgCode, currentLog]);

  const handleCopy = () => {
    if (svgCode) {
      navigator.clipboard.writeText(svgCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!svgCode) return;
    const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = prompt.trim()
      ? prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      : 'animated-vector';
    link.download = `${safeName}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Generates and downloads the comprehensive 8-page Technical Deliverables
   * & Forensic Token Audit PDF dossier
   */
  const handleDownloadPdfReport = useCallback(async () => {
    if (!svgCode) return;
    setIsGeneratingPdf(true);
    setError(null);
    try {
      let logToExport = currentLog;
      if (!logToExport || logToExport.finalSvgMarkup !== svgCode) {
        logToExport = createFallbackLogFromSvg({
          svgCode,
          prompt: prompt || 'Animated Vector Graphic',
          provider: selectedProvider,
          model: selectedModel,
          usage: lastUsage,
          presetApplied: activePreset || undefined,
        });
        setCurrentLog(logToExport);
      }
      await generateAndDownloadReportPdf(logToExport);
    } catch (pdfErr) {
      console.error('PDF Generation failed:', pdfErr);
      setError(pdfErr instanceof Error ? pdfErr.message : 'Failed to generate PDF audit report.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [svgCode, currentLog, prompt, selectedProvider, selectedModel, lastUsage, activePreset]);

  const isGenerateDisabled = isLoading || isDecomposing || isLayerGenerating || !prompt.trim() || (mode === 'image' && images.length === 0);

  const activeModelDetails = SUPPORTED_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-400">
                SVG Image Analyzer & Animator
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Multi-Layer Decompose & Stitch Vector Engine with Hand-Drawn Character Fidelity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeModelDetails && (
              <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-medium">{activeModelDetails.name}</span>
              </div>
            )}
            <button
              onClick={handleGenerateGoogleIcon}
              disabled={isLoading || isDecomposing || isLayerGenerating}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium py-2 px-3 sm:px-4 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
              title="Load interactive animated Google Logo sample"
            >
              <GoogleIcon />
              <span className="hidden sm:inline">Spinning Google Logo</span>
              <span className="sm:hidden">Logo Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Model Config, Input & Creator Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
            
            {/* Multi-Model Selector & Settings */}
            <ModelSelector
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={setSelectedProvider}
              onModelChange={setSelectedModel}
              settings={settings}
              onSettingsChange={handleSettingsChange}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              disabled={isLoading || isDecomposing || isLayerGenerating}
            />

            {/* Vector Synthesis Strategy (Divide & Stitch vs Single Shot) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center justify-between">
                <span>Vector Synthesis Architecture</span>
                <span className="text-[11px] text-cyan-400 font-normal">Layer Separation Mode</span>
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStrategy('decompose')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center ${
                    strategy === 'decompose'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  🧩 Decompose & Stitch (Max Detail)
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy('single')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center ${
                    strategy === 'single'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  ⚡ Single-Shot (Fast)
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                {strategy === 'decompose'
                  ? '✨ Separates the image into distinct semantic parts (Background, Character Anatomy, Props, Effects) with dedicated token budgets, then stitches them into a cohesive scene.'
                  : 'Synthesizes the entire scene in a single model turn. Fast, but character anatomy may be compressed.'}
              </p>
            </div>

            {/* Input Mode Selector */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Input Mode
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('image')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === 'image'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  Image Reference
                </button>
                <button
                  type="button"
                  onClick={() => setMode('text')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === 'text'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  Text Only Creator
                </button>
              </div>
            </div>

            {/* Image Uploader Section (Image Mode) */}
            {mode === 'image' && (
              <div>
                <label className="text-sm font-semibold text-slate-200 mb-2 flex items-center justify-between">
                  <span>1. Reference Artwork to Decompose</span>
                  <span className="text-xs text-emerald-400 font-mono">100% Native Resolution (Full Precision)</span>
                </label>
                <ImageUploader files={images} onFilesChange={setImages} />
              </div>
            )}

            {/* Prompt Input Section */}
            <div>
              <label htmlFor="prompt" className="text-sm font-semibold text-slate-200 mb-2 block">
                {mode === 'image' ? '2. Scene Description & Stylistic Direction' : 'Describe the Animated SVG Scene'}
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'image'
                    ? "e.g., 'Recreate this character and companion with authentic hand-drawn vector linework, textured hair, facial expressions, and cel-shaded clothing.'"
                    : "e.g., 'A modern glowing neon battery icon that progressively charges up and pulses with electric energy.'"
                }
                rows={3}
                className="w-full p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all placeholder-slate-500 text-slate-200 text-sm leading-relaxed resize-y"
              />

              {/* Sample Prompts */}
              <div className="mt-2.5">
                <span className="text-xs text-slate-400 block mb-1.5 font-medium">Quick ideas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(sample)}
                      className="text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-slate-700/60 transition-colors text-left"
                    >
                      {sample.length > 36 ? sample.slice(0, 34) + '...' : sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGeneration}
              disabled={isGenerateDisabled}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600 hover:from-cyan-400 hover:via-blue-400 hover:to-violet-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transform active:scale-[0.99]"
            >
              {isLoading || isDecomposing || isLayerGenerating ? <Loader /> : <SparklesIcon />}
              <span>
                {isDecomposing
                  ? 'Step 1/2: Decomposing Visual Layers...'
                  : isLayerGenerating
                  ? `Step 2/2: Synthesizing ${currentGeneratingLayerName || 'Layers'}...`
                  : strategy === 'decompose'
                  ? 'Decompose & Stitch High-Fidelity SVG'
                  : 'Generate Animated SVG'}
              </span>
            </button>

            {/* Token Consumption & Cost Audit Card */}
            {lastUsage && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>📊 Token Consumption Audit</span>
                  </span>
                  {lastUsage.costUsd !== undefined && (
                    <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                      ${lastUsage.costUsd.toFixed(4)} USD
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 uppercase text-[9px]">Input Tokens</div>
                    <div className="text-slate-200 font-bold text-xs mt-0.5">
                      {lastUsage.inputTokens?.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 uppercase text-[9px]">Output Tokens</div>
                    <div className="text-cyan-400 font-bold text-xs mt-0.5">
                      {lastUsage.outputTokens?.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 uppercase text-[9px]">Thinking Tokens</div>
                    <div className="text-violet-400 font-bold text-xs mt-0.5">
                      {lastUsage.thinkingTokens?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 uppercase text-[9px]">Cached Input</div>
                    <div className="text-emerald-400 font-bold text-xs mt-0.5">
                      {lastUsage.cachedTokens?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>

                {scenePlan && scenePlan.layers.some((l) => l.usage) && (
                  <div className="pt-1 border-t border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">
                      Per-Layer Token Breakdown:
                    </div>
                    <div className="space-y-1">
                      {scenePlan.planningUsage && (
                        <div className="flex justify-between text-[10px] text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded">
                          <span>Layer Planner</span>
                          <span>In: {scenePlan.planningUsage.inputTokens?.toLocaleString()} │ Out: {scenePlan.planningUsage.outputTokens?.toLocaleString()}</span>
                        </div>
                      )}
                      {scenePlan.layers.map((l) => (
                        <div key={l.id} className="flex justify-between text-[10px] text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded">
                          <span className="truncate max-w-[140px]">{l.name}</span>
                          <span>
                            {l.usage
                              ? `In: ${l.usage.inputTokens?.toLocaleString()} │ Out: ${l.usage.outputTokens?.toLocaleString()}`
                              : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-800/70 rounded-xl text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
                <span className="text-rose-400 text-base">⚠️</span>
                <div className="flex-1 leading-snug">{error}</div>
              </div>
            )}
          </div>

          {/* Right Column: Output Viewer, Layer Manager & Presets (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
            
            {/* SVG Viewer Header */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-200">
                    Interactive Stitched Canvas
                  </h2>
                  {activePreset && (
                    <span className="text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full">
                      Preset: {activePreset}
                    </span>
                  )}
                  {scenePlan && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                      {scenePlan.layers.length} Layers Stitched
                    </span>
                  )}
                </div>

                {originalSvgCode && activePreset && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    Reset to AI Original
                  </button>
                )}
              </div>

              {/* Viewer Window */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 flex items-center justify-center min-h-[340px] sm:min-h-[380px] overflow-hidden relative">
                {(isLoading || isDecomposing || isLayerGenerating) && !svgCode && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader />
                    <p className="text-sm text-cyan-300 font-medium animate-pulse">
                      {isDecomposing
                        ? 'Decomposing scene into character, environment & linework layers...'
                        : `Rendering ${currentGeneratingLayerName || 'layer'} with dedicated token budget...`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Focusing 100% attention on anatomy, facial contours & cel-shading
                    </p>
                  </div>
                )}
                {svgCode && <SvgViewer svgCode={svgCode} />}
                {!isLoading && !isDecomposing && !isLayerGenerating && !svgCode && (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500">
                      <SparklesIcon />
                    </div>
                    <p className="text-slate-300 font-medium">No SVG Generated Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Upload your image and choose "Decompose & Stitch" for maximum character resemblance.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Layer Manager Component: Shows decomposed scene parts, visibility toggles & re-render */}
            <LayerManager
              plan={scenePlan}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              onToggleLayerVisibility={handleToggleLayerVisibility}
              onRegenerateLayer={handleRegenerateLayer}
              isDecomposing={isDecomposing}
              isLayerGenerating={isLayerGenerating}
              currentGeneratingLayerName={currentGeneratingLayerName}
            />

            {/* Animation Presets Bar */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <AnimationPresets
                onPresetSelect={handleApplyPreset}
                activePreset={activePreset}
                disabled={!originalSvgCode || isLoading || isDecomposing || isLayerGenerating}
              />
            </div>

            {/* Audit Dossier & PDF Deliverables Card */}
            {svgCode && (
              <div className="bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-900 border border-violet-700/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-violet-950/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-violet-200">
                        Official Technical Deliverables & Forensic Audit Report
                      </h4>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-700/60 font-semibold">
                        8-Page Dossier
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {currentLog?.iterations?.length || 1} logged synthesis step(s) • Method 1 Algorithmic Splines • Method 2 Comic Inks (White & Alpha) • Method 3 Blue-Line tracing template • Full token audit table ({currentLog ? currentLog.totalTokens.totalTokens.toLocaleString() : lastUsage ? lastUsage.totalTokens.toLocaleString() : '1,420+'} tokens logged).
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadPdfReport}
                  disabled={isGeneratingPdf}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-violet-900/40 transition-all disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Compiling 8-Pg PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download report.pdf</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Generated Code & Export Panel */}
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <span>Stitched SVG Markup</span>
                  {svgCode && (
                    <span className="text-xs font-normal text-slate-500 font-mono">
                      ({(new TextEncoder().encode(svgCode).length / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    disabled={!svgCode}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    title="Copy SVG XML to clipboard"
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                    <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={!svgCode}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium shadow-sm"
                    title="Download animated .svg file"
                  >
                    <DownloadIcon />
                    <span>Download .svg</span>
                  </button>
                  <button
                    onClick={handleDownloadPdfReport}
                    disabled={!svgCode || isGeneratingPdf}
                    className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white px-3 py-1.5 rounded-lg transition-all font-semibold shadow-md shadow-indigo-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Download publication-grade 8-Page Technical Deliverables & Forensic Token Audit PDF Report"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Compiling PDF...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-cyan-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download report.pdf</span>
                        <span className="text-[10px] bg-slate-900/80 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                          8-Pg
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <textarea
                  readOnly
                  value={svgCode}
                  placeholder="Generated SVG code will appear here..."
                  className="w-full h-44 bg-transparent border-none resize-y focus:outline-none focus:ring-0 text-cyan-300 font-mono text-xs p-3.5 leading-relaxed selection:bg-cyan-900"
                  spellCheck={false}
                />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
