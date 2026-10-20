import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part } from "@google/genai";

export type ProviderId = 'anthropic' | 'google' | 'openai' | 'ollama';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ProviderId;
  description: string;
  maxTokens: number;
  temperature: number;
  badge?: string;
}

export interface ProviderSettings {
  apiKey?: string;
  baseUrl?: string;
}

export interface ImagePayload {
  mimeType: string;
  data: string; // Base64 without data:image/... prefix
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
  thinkingTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export function computeCostUsd(model: string, usage: TokenUsage): number {
  const inTok = Math.max(0, (usage.inputTokens || 0) - (usage.cachedTokens || 0));
  const cachedTok = usage.cachedTokens || 0;
  const outTok = usage.outputTokens || 0;

  if (model.includes('opus')) {
    return (inTok * 15.0 + cachedTok * 1.5 + outTok * 75.0) / 1_000_000;
  }
  if (model.includes('haiku')) {
    return (inTok * 0.8 + cachedTok * 0.08 + outTok * 4.0) / 1_000_000;
  }
  // Default Sonnet 5.5 / 4.5 rate: $3.00/M in, $0.30/M cached in, $15.00/M out
  return (inTok * 3.0 + cachedTok * 0.3 + outTok * 15.0) / 1_000_000;
}

export interface GenerationRequest {
  provider: ProviderId;
  model: string;
  prompt: string;
  images: ImagePayload[];
  settings?: ProviderSettings;
  temperature?: number;
}

export interface GenerationResponse {
  svgText: string;
  usage?: TokenUsage;
}

export const SUPPORTED_MODELS: ModelDefinition[] = [
  // Anthropic Claude
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    provider: 'anthropic',
    description: 'Flagship vision & vector coding. Unconstrained token budget for maximum character resemblance & hand-drawn linework',
    maxTokens: 32768,
    temperature: 0.15,
    badge: 'Ultra High Detail',
  },
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    provider: 'anthropic',
    description: 'Deepest multimodal reasoning for complex multi-character anatomy, comic inks, and intricate compositions',
    maxTokens: 32768,
    temperature: 0.15,
    badge: 'Deep Reasoning',
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    provider: 'anthropic',
    description: 'Fast vector synthesis and responsive layout generation',
    maxTokens: 8192,
    temperature: 0.2,
    badge: 'Fast',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Stable generation with clean semantic hierarchy and smooth animations',
    maxTokens: 16384,
    temperature: 0.2,
  },
  // Google Gemini
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'google',
    description: 'Fast multimodal vector generation with complex Bézier curves',
    maxTokens: 8192,
    temperature: 0.2,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Deep multimodal reasoning for complex multi-layered vector compositions',
    maxTokens: 8192,
    temperature: 0.1,
  },
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    description: 'Vibrant color reproduction, multi-stop gradient mastery, and accurate contouring',
    maxTokens: 4096,
    temperature: 0.2,
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o-mini',
    provider: 'openai',
    description: 'Lightweight and budget-friendly animated vector generation',
    maxTokens: 4096,
    temperature: 0.3,
  },
  // Local / Self-Hosted
  {
    id: 'qwen2.5-vl:72b',
    name: 'Qwen2.5-VL 72B (Ollama / vLLM)',
    provider: 'ollama',
    description: 'Top open-weight vision model for private, rate-limit-free vector synthesis',
    maxTokens: 4096,
    temperature: 0.1,
    badge: 'Self-Hosted',
  },
  {
    id: 'llama3.2-vision:11b',
    name: 'Llama 3.2 Vision 11B (Ollama)',
    provider: 'ollama',
    description: 'Efficient local multimodal model running completely on local hardware',
    maxTokens: 4096,
    temperature: 0.1,
  },
];

export const SYSTEM_INSTRUCTION = `You are an expert master vector artist and professional comic illustrator.
Your task is to analyze the provided image(s) and recreate the artwork as an authentic, high-fidelity SVG with meticulous hand-drawn linework, accurate character resemblance, and embedded SMIL animations.

CRITICAL REQUIREMENTS:
1. Return ONLY the raw SVG code starting with '<svg' and ending with '</svg>'.
2. Do not include markdown code block formatting (such as \`\`\`xml or \`\`\`svg) or any explanatory text.
3. Ensure the SVG has viewBox, xmlns="http://www.w3.org/2000/svg", and preserveAspectRatio="xMidYMid meet" attributes for high quality and responsiveness.
4. FAITHFUL CHARACTER & SCENE RESEMBLANCE (UNCONSTRAINED DETAIL):
   - Capture exact facial anatomy: eye shapes, iris reflections, eyelashes, nose bridge contours, lip curvature, and expressive eyebrow tilt matching the reference image.
   - Recreate hair volume and strands with sweeping cubic Bézier curves (C and S commands) and multi-tone highlights.
   - Draw authentic comic linework with distinct stroke weights, clean cel-shading, and fabric folds on jackets/clothing.
   - Replicate props, robotic components, and architectural perspective with exact geometry, metallic reflections, and glowing accents.
   - Do NOT simplify, approximate, or cut corners. Use as many cubic Bézier segments as needed to achieve 1:1 artistic fidelity.
5. GRADIENTS & LIGHTING:
   - Define multi-stop <linearGradient> and <radialGradient> elements inside <defs> for specular rim lighting, ambient shadows, and rich color transitions.
   - Organize artwork into clear semantic groups: <g id="background">, <g id="main-character">, <g id="companion-robot">, <g id="highlights">.
6. SMIL ANIMATIONS:
   - Embed smooth, looping SMIL tags (<animateTransform>, <animate>) with appropriate keyTimes and dur attributes.
   - Make animations subtle and lifelike (e.g., character breathing, soft blinking lens, pulsing screen glow).`;

function normalizeAnthropicMediaType(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const clean = (mime || '').toLowerCase().trim();
  if (clean === 'image/jpeg' || clean === 'image/jpg') return 'image/jpeg';
  if (clean === 'image/webp') return 'image/webp';
  if (clean === 'image/gif') return 'image/gif';
  return 'image/png';
}

/**
 * Executes SVG generation with Anthropic Messages API
 * Features Anthropic Prompt Caching (`cache_control`) for 90% input token cost reduction
 */
async function generateWithAnthropic(
  model: string,
  prompt: string,
  images: ImagePayload[],
  settings?: ProviderSettings,
  temperature?: number
): Promise<GenerationResponse> {
  const envKey = (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : '') || '';
  const apiKey = settings?.apiKey || envKey;

  if (!apiKey) {
    throw new Error('Anthropic API Key is missing. Please enter your key in the Model Settings panel.');
  }

  const endpoint = settings?.baseUrl
    ? `${settings.baseUrl.replace(/\/+$/, '')}/messages`
    : 'https://api.anthropic.com/v1/messages';

  const contentBlocks: any[] = [];

  // Add images to content payload with guaranteed valid media_type
  for (const img of images) {
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: normalizeAnthropicMediaType(img.mimeType),
        data: img.data,
      },
    });
  }

  // Add user prompt with ephemeral prompt caching if multiple images are provided
  contentBlocks.push({
    type: 'text',
    text: prompt,
  });

  const requestPayload: any = {
    model: model || 'claude-sonnet-5-5',
    max_tokens: 32768,
    // Prompt Caching enabled on system instruction
    system: [
      {
        type: 'text',
        text: SYSTEM_INSTRUCTION,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: contentBlocks }],
  };

  // Modern Claude 5.5 and 4.5 models have deprecated the temperature parameter.
  // Only include temperature for legacy 3.x models if explicitly provided.
  if (model && model.startsWith('claude-3-') && temperature !== undefined) {
    requestPayload.temperature = temperature;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMsg = errorBody;
    try {
      const json = JSON.parse(errorBody);
      if (json.error?.message) parsedMsg = json.error.message;
    } catch {}
    throw new Error(`Anthropic API error (${response.status}): ${parsedMsg}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: any) => block.type === 'text');
  
  const inTok = data.usage?.input_tokens || 0;
  const outTok = data.usage?.output_tokens || 0;
  const cachedTok = data.usage?.cache_read_input_tokens || 0;
  const cacheCreationTok = data.usage?.cache_creation_input_tokens || 0;
  const thinkingTok = data.usage?.output_tokens_details?.thinking_tokens || 0;

  const usage: TokenUsage = {
    inputTokens: inTok,
    outputTokens: outTok,
    cachedTokens: cachedTok,
    cacheCreationTokens: cacheCreationTok,
    thinkingTokens: thinkingTok,
    totalTokens: inTok + outTok,
    costUsd: computeCostUsd(model || 'claude-sonnet-5-5', {
      inputTokens: inTok,
      outputTokens: outTok,
      cachedTokens: cachedTok,
    }),
  };

  return {
    svgText: textBlock ? textBlock.text : '',
    usage,
  };
}

/**
 * Executes SVG generation with Google Gemini
 */
async function generateWithGemini(
  model: string,
  prompt: string,
  images: ImagePayload[],
  settings?: ProviderSettings,
  temperature?: number
): Promise<GenerationResponse> {
  const apiKey =
    settings?.apiKey ||
    (typeof process !== 'undefined' ? process.env?.API_KEY || process.env?.GEMINI_API_KEY : '') ||
    '';

  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please enter your key in the Model Settings panel or configure GEMINI_API_KEY.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const imageParts: Part[] = images.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.data,
    },
  }));

  const textPart: Part = { text: prompt };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: model || 'gemini-3.8-flash',
    contents: { parts: [textPart, ...imageParts] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: temperature ?? 0.2,
    },
  });

  return {
    svgText: response.text || '',
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    },
  };
}

/**
 * Executes SVG generation with OpenAI Chat Completions API
 */
async function generateWithOpenAI(
  model: string,
  prompt: string,
  images: ImagePayload[],
  settings?: ProviderSettings,
  temperature?: number
): Promise<GenerationResponse> {
  const apiKey = settings?.apiKey || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : '') || '';
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please enter your key in the Model Settings panel.');
  }

  const endpoint = settings?.baseUrl
    ? `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';

  const contentPayload: any[] = [{ type: 'text', text: prompt }];

  for (const img of images) {
    contentPayload.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
        detail: 'high',
      },
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: contentPayload },
      ],
      temperature: temperature ?? 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return {
    svgText: data.choices?.[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

/**
 * Executes SVG generation with Local / Self-Hosted Models via Ollama or vLLM
 */
async function generateWithLocalOllama(
  model: string,
  prompt: string,
  images: ImagePayload[],
  settings?: ProviderSettings,
  temperature?: number
): Promise<GenerationResponse> {
  const baseUrl = settings?.baseUrl || 'http://localhost:11434';
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  const apiKey = settings?.apiKey || 'ollama';

  const contentPayload: any[] = [{ type: 'text', text: prompt }];

  for (const img of images) {
    contentPayload.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'qwen2.5-vl:72b',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: contentPayload },
      ],
      temperature: temperature ?? 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Local inference server error (${response.status}): ${errorBody}. Ensure Ollama or vLLM is running at ${baseUrl}`);
  }

  const data = await response.json();
  return {
    svgText: data.choices?.[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

/**
 * Master Unified SVG Generation Dispatcher
 */
export async function generateSvgUnified(req: GenerationRequest): Promise<GenerationResponse> {
  const { provider, model, prompt, images, settings, temperature } = req;

  switch (provider) {
    case 'anthropic':
      return generateWithAnthropic(model, prompt, images, settings, temperature);
    case 'google':
      return generateWithGemini(model, prompt, images, settings, temperature);
    case 'openai':
      return generateWithOpenAI(model, prompt, images, settings, temperature);
    case 'ollama':
      return generateWithLocalOllama(model, prompt, images, settings, temperature);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
