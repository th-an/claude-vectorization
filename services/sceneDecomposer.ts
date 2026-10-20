/**
 * Hierarchical Scene Decomposition & Stitched Assembly Engine
 * 
 * Solves single-shot VLM character degradation by breaking a complex raster image
 * into semantic z-ordered layers (Background, Props, Character A, Character B, Effects).
 * Each layer receives dedicated token budgets and focused visual attention,
 * and the resulting vector fragments are stitched into a unified, high-fidelity animated SVG.
 */

import {
  ProviderId,
  ProviderSettings,
  ImagePayload,
  TokenUsage,
  generateSvgUnified,
} from './modelProviders';
import { extractSvg, sanitizeSvg } from '../utils/svgSecurity';

export interface SceneLayer {
  id: string;
  name: string;
  role: 'background' | 'character' | 'prop' | 'effects' | 'foreground';
  zIndex: number;
  description: string;
  focusedPrompt: string;
  animationDirection?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  svgMarkup?: string;
  error?: string;
  visible?: boolean;
  usage?: TokenUsage;
}

export interface SceneDecompositionPlan {
  sceneTitle: string;
  viewBox: { width: number; height: number };
  layers: SceneLayer[];
  planningUsage?: TokenUsage;
  totalUsage?: TokenUsage;
}

const DECOMPOSITION_SYSTEM_PROMPT = `You are a master vector art director and visual scene decomposition specialist.
Your task is to analyze the provided image(s) and break the scene down into 2 to 4 distinct, semantic, z-ordered layers for separate, high-fidelity vector synthesis.

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON object matching the requested schema. No markdown fences, no conversational prose.
2. Structure the scene into distinct logical layers:
   - Background & Environment (walls, floor, furniture, architecture)
   - Primary Subject / Character (facial anatomy, clothing folds, posture, hair)
   - Secondary Subject / Robot / Vehicle / Companion (props, machinery, sidekicks)
   - Foreground / Accents / Overlays (speech bubbles, lighting glows, particles)
3. For each layer, write an extremely detailed, hyper-focused prompt that instructs an SVG artist on EXACT contours, colors, shading, and animations.
4. Schema:
{
  "sceneTitle": "string",
  "viewBox": { "width": 1000, "height": 600 },
  "layers": [
    {
      "id": "unique-kebab-id",
      "name": "Human Readable Layer Name",
      "role": "background" | "character" | "prop" | "foreground",
      "zIndex": 1,
      "description": "Short summary",
      "focusedPrompt": "Very specific visual instruction for this part alone",
      "animationDirection": "Specific SMIL animation suggestion"
    }
  ]
}`;

/**
 * Stage 1: Decomposes an image into semantic layers
 */
export async function planSceneDecomposition(
  prompt: string,
  images: ImagePayload[],
  provider: ProviderId,
  model: string,
  settings?: ProviderSettings
): Promise<SceneDecompositionPlan> {
  const decomposeRequestPrompt = `Analyze this scene and decompose it into 2 to 4 semantic layers for high-detail vector synthesis.
User direction: "${prompt || 'Recreate this artwork with authentic character fidelity, crisp linework, and layered depth.'}"

Generate the JSON decomposition plan with viewBox width/height and layered focused prompts.`;

  const response = await generateSvgUnified({
    provider,
    model,
    prompt: decomposeRequestPrompt,
    images,
    settings,
    temperature: 0.1,
  });

  const rawText = response.svgText || '';
  
  // Extract JSON from potential markdown wrapping
  let jsonStr = rawText.trim();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const layers: SceneLayer[] = (parsed.layers || []).map((l: any, idx: number) => ({
      id: l.id || `layer-${idx + 1}`,
      name: l.name || `Layer ${idx + 1}`,
      role: l.role || (idx === 0 ? 'background' : 'character'),
      zIndex: l.zIndex !== undefined ? l.zIndex : idx + 1,
      description: l.description || '',
      focusedPrompt: l.focusedPrompt || l.name,
      animationDirection: l.animationDirection || 'Subtle animated motion',
      status: 'pending',
      visible: true,
    }));

    return {
      sceneTitle: parsed.sceneTitle || 'Multi-Layer Vector Scene',
      viewBox: parsed.viewBox || { width: 1000, height: 600 },
      layers: layers.sort((a, b) => a.zIndex - b.zIndex),
      planningUsage: response.usage,
    };
  } catch (err) {
    console.error('Failed to parse decomposition JSON, using intelligent fallback:', err, rawText);
    // Intelligent Fallback Plan
    return {
      sceneTitle: 'High-Fidelity Multi-Layer Scene',
      viewBox: { width: 1000, height: 600 },
      planningUsage: response.usage,
      layers: [
        {
          id: 'layer-background',
          name: '1. Environment & Background Structure',
          role: 'background',
          zIndex: 1,
          description: 'Room perspective, walls, floor, and static furniture.',
          focusedPrompt: `Synthesize the background environment from the reference images: room perspective, walls, furniture, workstation desk, and static structural elements. Provide clean cel-shading and perspective gradients. Match viewBox 0 0 1000 600.`,
          animationDirection: 'Gentle ambient lighting pulse',
          status: 'pending',
          visible: true,
        },
        {
          id: 'layer-primary-subject',
          name: '2. Primary Character (High Precision)',
          role: 'character',
          zIndex: 2,
          description: 'Human / main character with facial contours, hair strands, and clothing anatomy.',
          focusedPrompt: `Synthesize the primary character from the reference image with extreme anatomical fidelity: exact facial contours, expressive eyes, hair styling, textured clothing folds, and authentic color palette. Dedicate your full detail budget to capturing character identity. Match viewBox 0 0 1000 600. Transparent background outside character silhouette.`,
          animationDirection: 'Subtle breathing and eye blink animation',
          status: 'pending',
          visible: true,
        },
        {
          id: 'layer-secondary-subject',
          name: '3. Companion / Props / Linework',
          role: 'prop',
          zIndex: 3,
          description: 'Secondary characters, robots, props, and accent dialogue/speech balloons.',
          focusedPrompt: `Synthesize the companion character (robot/props/speech bubble) from the reference image with crisp linework and metallic/specular highlights. Transparent background outside character bounds. Match viewBox 0 0 1000 600.`,
          animationDirection: 'Active gesture, glowing lens pulse, or spinning antenna',
          status: 'pending',
          visible: true,
        },
      ],
    };
  }
}

/**
 * Stage 2: Generates a single dedicated layer with focused token budget
 */
export async function synthesizeSingleLayer(
  layer: SceneLayer,
  plan: SceneDecompositionPlan,
  images: ImagePayload[],
  provider: ProviderId,
  model: string,
  settings?: ProviderSettings
): Promise<{ svgMarkup: string; usage?: TokenUsage }> {
  const layerPrompt = `You are a master comic illustrator generating LAYER "${layer.name}" (${layer.role}, z-index ${layer.zIndex}) of a multi-layer vector masterpiece.
TARGET VIEWBOX: viewBox="0 0 ${plan.viewBox.width} ${plan.viewBox.height}"

UNCONSTRAINED ARTISTIC PRECISION & HAND-DRAWN QUALITY:
- ${layer.focusedPrompt}
- Animation direction: ${layer.animationDirection || 'Smooth subtle SMIL animation'}
- HAND-DRAWN FIDELITY: Capture exact facial features, anatomical contours, expressive eyes, hair volume/strands, textured clothing folds, and authentic cel-shading matching the reference image.
- DO NOT SIMPLIFY. Use rich cubic Bézier curves (C and S commands) and multi-stop gradients for specular highlights and depth.
- TRANSPARENCY: Any area not occupied by this layer's objects MUST be 100% transparent (do NOT generate an opaque background rectangle unless this is the base background layer).
- Coordinate alignment: Objects must be placed in their exact scene positions corresponding to viewBox="0 0 ${plan.viewBox.width} ${plan.viewBox.height}".
- Return ONLY clean SVG markup (<svg ...> ... </svg>).`;

  const response = await generateSvgUnified({
    provider,
    model,
    prompt: layerPrompt,
    images,
    settings,
    temperature: 0.15,
  });

  const clean = extractSvg(response.svgText);
  return {
    svgMarkup: sanitizeSvg(clean),
    usage: response.usage,
  };
}

/**
 * Stage 3: Stitches all layer SVGs into a unified, layered vector composition
 */
export function stitchSceneLayers(
  plan: SceneDecompositionPlan,
  layers: SceneLayer[]
): string {
  const activeLayers = layers.filter((l) => l.visible !== false && l.svgMarkup);
  if (activeLayers.length === 0) return '';

  const accumulatedDefs: string[] = [];
  const assembledGroups: string[] = [];

  const { width, height } = plan.viewBox;

  activeLayers.forEach((layer) => {
    let svg = layer.svgMarkup || '';
    if (!svg.startsWith('<svg')) return;

    // 1. Extract <defs> content
    const defsMatch = svg.match(/<defs[^>]*>([\s\S]*?)<\/defs>/i);
    if (defsMatch && defsMatch[1]) {
      // Prefix IDs inside defs to prevent collision across layers
      let defsContent = defsMatch[1];
      const prefix = `${layer.id}-`;
      defsContent = defsContent.replace(/id="([^"]+)"/g, `id="${prefix}$1"`);
      defsContent = defsContent.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
      accumulatedDefs.push(defsContent.trim());
    }

    // 2. Strip root <svg> wrapper and <defs> to get pure graphical content
    let innerContent = svg
      .replace(/<svg[^>]*>/i, '')
      .replace(/<\/svg>/i, '')
      .replace(/<defs[^>]*>[\s\S]*?<\/defs>/gi, '')
      .trim();

    // Re-link prefixed defs in innerContent
    const prefix = `${layer.id}-`;
    innerContent = innerContent.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);

    assembledGroups.push(`
      <!-- Layer: ${layer.name} (z-index: ${layer.zIndex}) -->
      <g id="layer-${layer.id}" data-layer-name="${layer.name}" data-layer-role="${layer.role}">
        ${innerContent}
      </g>
    `);
  });

  const mergedDefsTag = accumulatedDefs.length > 0
    ? `\n  <defs>\n    ${accumulatedDefs.join('\n    ')}\n  </defs>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${mergedDefsTag}
  ${assembledGroups.join('\n')}
</svg>`.trim();
}
