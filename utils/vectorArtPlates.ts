/**
 * Multi-Method Vector Plate Generator
 * Derives production master plates from raw SVG:
 * 1. Master Plate (Full-Color Vector Render)
 * 2. Crisp Comic Inks - White Plate (#111111 black linework on pure white #FFFFFF)
 * 3. Crisp Comic Inks - Transparent Alpha Plate (32-bit transparent RGBA)
 * 4. Traditional Blue-Line Comic Tracing Guide (Non-Photo Blue #5AB3E8 drafting plate)
 */

export type PlateType = 'master' | 'inks_white' | 'inks_alpha' | 'blueline';

/**
 * Transforms SVG markup into comic linework or blue-line variations
 */
export function transformSvgForPlate(svgCode: string, type: PlateType): string {
  if (type === 'master') return svgCode;

  let transformed = svgCode;

  if (type === 'inks_white' || type === 'inks_alpha') {
    // Strip colored fills and enforce black comic strokes
    transformed = transformed.replace(/fill="([^"]+)"/gi, (match, val) => {
      if (val === 'none' || val === 'transparent') return 'fill="none"';
      return type === 'inks_white' ? 'fill="#FFFFFF"' : 'fill="none"';
    });

    transformed = transformed.replace(/stroke="([^"]+)"/gi, 'stroke="#111111"');

    // Ensure all paths have a comic ink stroke
    transformed = transformed.replace(/<path\b([^>]*?)(\/?>)/gi, (match, attrs, closing) => {
      if (!/stroke=/i.test(attrs)) {
        return `<path ${attrs} stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${closing}`;
      }
      return match;
    });

    return transformed;
  }

  if (type === 'blueline') {
    // Classic Non-Photo Blue (#5AB3E8 / RGB 75, 165, 230)
    transformed = transformed.replace(/fill="([^"]+)"/gi, (match, val) => {
      if (val === 'none' || val === 'transparent') return 'fill="none"';
      return 'fill="rgba(90, 179, 232, 0.22)"';
    });

    transformed = transformed.replace(/stroke="([^"]+)"/gi, 'stroke="#5AB3E8"');

    transformed = transformed.replace(/<path\b([^>]*?)(\/?>)/gi, (match, attrs, closing) => {
      if (!/stroke=/i.test(attrs)) {
        return `<path ${attrs} stroke="#5AB3E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${closing}`;
      }
      return match;
    });

    return transformed;
  }

  return transformed;
}

/**
 * Rasterizes SVG to high-resolution PNG Data URL via offscreen canvas
 */
export function rasterizeSvgToDataUrl(
  svgCode: string,
  type: PlateType = 'master',
  targetWidth = 1200,
  targetHeight = 750
): Promise<string> {
  return new Promise((resolve) => {
    const transformedSvg = transformSvgForPlate(svgCode, type);
    const blob = new Blob([transformedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve('');
        return;
      }

      // Fill background based on plate type
      if (type === 'inks_white' || type === 'blueline') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else if (type === 'master') {
        ctx.fillStyle = '#060A14';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } // inks_alpha leaves transparent

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw centered with aspect ratio preservation
      const imgRatio = img.width / img.height;
      const canvasRatio = targetWidth / targetHeight;
      let drawW = targetWidth;
      let drawH = targetHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawH = targetWidth / imgRatio;
        offsetY = (targetHeight - drawH) / 2;
      } else {
        drawW = targetHeight * imgRatio;
        offsetX = (targetWidth - drawW) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      resolve(canvas.toDataURL('image/png', 0.95));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
}
