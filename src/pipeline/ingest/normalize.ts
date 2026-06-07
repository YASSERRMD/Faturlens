// Pixel → tensor normalization matching the LFM2.5-VL preprocessor contract.
// The pure transform (RGBA bytes → normalized CHW float array) is unit-tested;
// the canvas/bitmap glue lives in the worker.

export interface NormalizeConfig {
  /** Square edge the encoder expects. */
  size: number;
  /** Per-channel mean (RGB), in [0, 1]. */
  mean: readonly [number, number, number];
  /** Per-channel std (RGB), in [0, 1]. */
  std: readonly [number, number, number];
}

// Defaults; overridden from processor_config.json at load time.
export const DEFAULT_NORMALIZE: NormalizeConfig = {
  size: 512,
  mean: [0.5, 0.5, 0.5],
  std: [0.5, 0.5, 0.5],
};

/**
 * Convert RGBA pixel bytes (length width*height*4) into a normalized,
 * channel-first (CHW) RGB Float32Array of length 3*width*height.
 */
export function pixelsToCHW(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  config: NormalizeConfig = DEFAULT_NORMALIZE,
): Float32Array {
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  const [meanR, meanG, meanB] = config.mean;
  const [stdR, stdG, stdB] = config.std;

  for (let i = 0; i < plane; i += 1) {
    const r = (rgba[i * 4] ?? 0) / 255;
    const g = (rgba[i * 4 + 1] ?? 0) / 255;
    const b = (rgba[i * 4 + 2] ?? 0) / 255;
    out[i] = (r - meanR) / stdR;
    out[plane + i] = (g - meanG) / stdG;
    out[2 * plane + i] = (b - meanB) / stdB;
  }
  return out;
}

/** Tensor dimensions for a CHW RGB image: [1, 3, size, size]. */
export function chwDims(size: number): [number, number, number, number] {
  return [1, 3, size, size];
}
