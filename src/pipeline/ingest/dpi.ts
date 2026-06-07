// PDF rasterization sizing. Pure math so DPI selection is unit-tested without
// pdf.js. PDF user-space units are points (72 per inch).

export const PDF_POINTS_PER_INCH = 72;
export const TARGET_LONG_EDGE_PX = 1536; // 3 tiles of 512
export const MAX_LONG_EDGE_PX = 2048;

export interface RenderSizing {
  /** Multiplier for pdf.js getViewport({ scale }). */
  scale: number;
  dpi: number;
  width: number;
  height: number;
}

/**
 * Choose a render scale so the page's longest edge lands near
 * {@link TARGET_LONG_EDGE_PX}, never exceeding {@link MAX_LONG_EDGE_PX}.
 */
export function sizingForPage(widthPt: number, heightPt: number): RenderSizing {
  const longestPt = Math.max(widthPt, heightPt);
  let scale = TARGET_LONG_EDGE_PX / longestPt;
  if (longestPt * scale > MAX_LONG_EDGE_PX) {
    scale = MAX_LONG_EDGE_PX / longestPt;
  }
  return {
    scale,
    dpi: scale * PDF_POINTS_PER_INCH,
    width: Math.round(widthPt * scale),
    height: Math.round(heightPt * scale),
  };
}
