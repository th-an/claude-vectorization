/**
 * SVG Extraction, Security Sanitization, and Validation Engine
 */

/**
 * Extracts raw SVG string from model response, stripping any surrounding markdown code fences
 * or preamble chatter.
 */
export function extractSvg(raw: string): string {
  if (!raw) return '';

  const start = raw.indexOf('<svg');
  const end = raw.lastIndexOf('</svg>');

  if (start !== -1 && end !== -1 && end > start) {
    return raw.substring(start, end + 6).trim();
  }

  // Fallback: strip markdown code blocks and search again
  const stripped = raw
    .replace(/```(xml|svg|html)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const secondStart = stripped.indexOf('<svg');
  const secondEnd = stripped.lastIndexOf('</svg>');

  if (secondStart !== -1 && secondEnd !== -1 && secondEnd > secondStart) {
    return stripped.substring(secondStart, secondEnd + 6).trim();
  }

  return stripped;
}

/**
 * Sanitizes SVG code to prevent Cross-Site Scripting (XSS) and injection vulnerabilities
 * before rendering in the browser DOM.
 * 
 * Removes:
 * - <script> tags
 * - Inline event handlers (onload, onerror, onclick, etc.)
 * - javascript: and data: pseudo-protocols in href and xlink:href
 * - <foreignObject> elements (which can embed arbitrary HTML)
 * - <!ENTITY> and doctype declarations to prevent XXE
 */
export function sanitizeSvg(svgCode: string): string {
  if (!svgCode) return '';

  let sanitized = svgCode;

  // 1. Remove XML/DOCTYPE entity declarations (prevent XXE attacks)
  sanitized = sanitized.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/<!ENTITY[\s\S]*?>/gi, '');

  // 2. Remove <script> tags and any contents
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<script[^>]*\/>/gi, '');

  // 3. Remove <foreignObject> tags and any contents
  sanitized = sanitized.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  sanitized = sanitized.replace(/<foreignObject[^>]*\/>/gi, '');

  // 4. Strip inline event listeners: on[a-z]+="..." or on[a-z]+='...'
  sanitized = sanitized.replace(/\son[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 5. Strip dangerous href and xlink:href targets (javascript: URIs)
  sanitized = sanitized.replace(/(href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1=""');
  sanitized = sanitized.replace(/(href|xlink:href)\s*=\s*["']\s*data:(?!image\/)[^"']*["']/gi, '$1=""');

  return sanitized.trim();
}

/**
 * Validates SVG structure and extracts geometric bounding information.
 */
export interface SvgValidationResult {
  valid: boolean;
  error?: string;
  hasViewBox: boolean;
  hasAnimations: boolean;
  viewBox?: { minX: number; minY: number; width: number; height: number };
}

export function validateSvg(svgCode: string): SvgValidationResult {
  if (!svgCode || typeof svgCode !== 'string') {
    return { valid: false, error: 'Empty or invalid SVG input', hasViewBox: false, hasAnimations: false };
  }

  const clean = svgCode.trim();
  if (!clean.startsWith('<svg') || !clean.endsWith('</svg>')) {
    return { valid: false, error: 'Missing standard <svg> root or </svg> closing tag', hasViewBox: false, hasAnimations: false };
  }

  // Check viewBox
  const viewBoxMatch = clean.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  let viewBox: { minX: number; minY: number; width: number; height: number } | undefined;

  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].trim().split(/[ ,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      viewBox = { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }

  // Check for SMIL animations
  const hasAnimations = /<(animate|animateTransform|animateMotion|animateColor|set)\b/i.test(clean);

  return {
    valid: true,
    hasViewBox: !!viewBox,
    hasAnimations,
    viewBox,
  };
}
