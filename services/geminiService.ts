import { generateSvgUnified, ProviderSettings, ImagePayload } from "./modelProviders";

export { SYSTEM_INSTRUCTION } from "./modelProviders";

/**
 * Backward-compatible helper for generating SVG from images with Gemini
 */
export async function generateSvgFromImages(
  prompt: string,
  images: ImagePayload[],
  settings?: ProviderSettings,
  model = "gemini-3.8-flash"
): Promise<string> {
  const res = await generateSvgUnified({
    provider: "google",
    model,
    prompt,
    images,
    settings,
  });
  return res.svgText;
}

/**
 * Backward-compatible helper for generating SVG from text with Gemini
 */
export async function generateSvgFromText(
  prompt: string,
  settings?: ProviderSettings,
  model = "gemini-3.8-flash"
): Promise<string> {
  const res = await generateSvgUnified({
    provider: "google",
    model,
    prompt,
    images: [],
    settings,
  });
  return res.svgText;
}
