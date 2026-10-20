// A unique ID to identify the group tag that holds our animations.
const ANIMATION_GROUP_ID = "preset-animation-group";

/**
 * A regex-based function to remove common SMIL animation elements from an SVG string.
 * This is a fallback for cleaning SVGs that might have animations from the AI.
 * It handles both self-closing <tag/> and regular <tag></tag> formats.
 */
const removeGenericAnimations = (svg: string): string => {
  const animationTagRegex = /<(animate|animateTransform|animateMotion|animateColor|set)[^>]*>.*?<\/\1>|<(animate|animateTransform|animateMotion|animateColor|set)[^>]*?\/>/gs;
  return svg.replace(animationTagRegex, '').trim();
};

export const AVAILABLE_PRESETS = [
  'Spin',
  'Pulse',
  'Float',
  'Bounce',
  'Wiggle',
  'Sway',
  'Nod',
  'Fade In',
  'Neon Breathe',
  'Wave',
  'Showcase',
] as const;

export type AnimationPreset = (typeof AVAILABLE_PRESETS)[number];

/**
 * Applies a preset animation to an SVG string.
 * This implementation first removes any animation group previously added by this function.
 * It then wraps the entire SVG content in a new <g> tag with a unique ID and applies
 * the selected preset animation to that group.
 *
 * @param svgCode The original SVG code as a string.
 * @param preset The name of the animation preset to apply.
 * @returns The SVG code with the new animation applied.
 */
export const applyAnimation = (svgCode: string, preset: string): string => {
  let cleanSvg = svgCode;

  // 1. Find and remove the animation group from a previous run.
  const groupRegex = new RegExp(`<g id="${ANIMATION_GROUP_ID}"[^>]*>([\\s\\S]*?)<\\/g>`);
  const match = cleanSvg.match(groupRegex);
  if (match) {
    // If we found our group, replace the entire group with just its inner content.
    cleanSvg = cleanSvg.replace(groupRegex, match[1]);
  }
  
  // 2. As a fallback, run a generic animation remover on the result.
  cleanSvg = removeGenericAnimations(cleanSvg);

  // 3. Find the main <svg> tag to extract its content and attributes.
  const svgTagMatch = cleanSvg.match(/<svg[^>]*>/);
  if (!svgTagMatch) {
    console.error('Invalid SVG code: could not find opening <svg> tag.');
    return svgCode; 
  }
  const svgTag = svgTagMatch[0];
  const svgTagIndex = cleanSvg.indexOf(svgTag);
  const closingSvgTagIndex = cleanSvg.lastIndexOf('</svg>');

  if (closingSvgTagIndex === -1) {
    console.error('Invalid SVG code: could not find closing </svg> tag.');
    return svgCode;
  }
  const svgContent = cleanSvg.substring(svgTagIndex + svgTag.length, closingSvgTagIndex);

  let animationTag = '';

  // Determine animation center and dimensions from viewBox
  const viewBoxMatch = svgTag.match(/viewBox="([^"]+)"/);
  let cx = 150, cy = 150, width = 300, height = 300, x = 0, y = 0;
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].trim().split(/[ ,]+/);
    if (parts.length === 4) {
      const [vx, vy, vw, vh] = parts.map(parseFloat);
      if (![vx, vy, vw, vh].some(isNaN)) {
        x = vx; y = vy; width = vw; height = vh;
        cx = x + width / 2;
        cy = y + height / 2;
      }
    }
  }
  
  // 4. Define the SMIL animation tag based on the selected preset.
  switch (preset.toLowerCase()) {
    case 'spin':
      animationTag = `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="3s" repeatCount="indefinite" />`;
      break;
    case 'pulse':
      animationTag = `<animateTransform attributeName="transform" type="scale" values="1; 1.08; 1" keyTimes="0; 0.5; 1" dur="1.2s" repeatCount="indefinite" additive="sum" transform-origin="${cx} ${cy}" />`;
      break;
    case 'fade in':
      animationTag = `<animate attributeName="opacity" from="0" to="1" dur="1.2s" fill="freeze" />`;
      break;
    case 'bounce':
      animationTag = `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -${height * 0.12}; 0 0" keyTimes="0; 0.5; 1" dur="0.6s" repeatCount="indefinite" />`;
      break;
    case 'wiggle':
      animationTag = `<animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy}; 6 ${cx} ${cy}; -6 ${cx} ${cy}; 0 ${cx} ${cy}" keyTimes="0; 0.3; 0.7; 1" dur="0.6s" repeatCount="indefinite" />`;
      break;
    case 'sway':
      animationTag = `<animateTransform attributeName="transform" type="translate" values="0 0; ${width * 0.05} 0; -${width * 0.05} 0; 0 0" keyTimes="0; 0.25; 0.75; 1" dur="3s" repeatCount="indefinite" />`;
      break;
    case 'nod':
      animationTag = `<animateTransform attributeName="transform" type="translate" values="0 0; 0 ${height * 0.05}; 0 0" keyTimes="0; 0.5; 1" dur="2s" repeatCount="indefinite" />`;
      break;
    case 'float':
      animationTag = `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -${height * 0.06}; 0 0" keyTimes="0; 0.5; 1" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />`;
      break;
    case 'neon breathe':
      animationTag = `
        <animate attributeName="opacity" values="0.75; 1; 0.75" keyTimes="0; 0.5; 1" dur="2s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="scale" values="0.98; 1.02; 0.98" keyTimes="0; 0.5; 1" dur="2s" repeatCount="indefinite" additive="sum" transform-origin="${cx} ${cy}" />
      `;
      break;
    case 'wave':
      animationTag = `<animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy + height * 0.4}; 8 ${cx} ${cy + height * 0.4}; -8 ${cx} ${cy + height * 0.4}; 0 ${cx} ${cy + height * 0.4}" keyTimes="0; 0.33; 0.66; 1" dur="1.8s" repeatCount="indefinite" />`;
      break;
    case 'showcase':
      const dur = "8s";
      const keyTimes = "0; 0.2; 0.4; 0.6; 0.8; 1";
      const translateValues = `0 0; 0 -${height * 0.05}; ${width * 0.04} 0; 0 ${height * 0.05}; -${width * 0.04} 0; 0 0`;
      animationTag = `
        <animateTransform attributeName="transform" type="translate" values="${translateValues}" keyTimes="${keyTimes}" dur="${dur}" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="scale" values="1; 1.05; 1; 1.05; 1; 1" keyTimes="${keyTimes}" dur="${dur}" repeatCount="indefinite" additive="sum" transform-origin="${cx} ${cy}" />
      `;
      break;
    default:
      return svgCode;
  }

  // 5. Wrap the static content in our uniquely identified <g> tag and append the animation.
  const animatedContent = `<g id="${ANIMATION_GROUP_ID}">${svgContent.trim()}${animationTag.trim()}</g>`;
  
  return `${svgTag}${animatedContent}</svg>`;
};
