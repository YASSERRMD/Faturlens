// EXIF orientation normalization. Modern browsers honor EXIF via
// createImageBitmap's imageOrientation: 'from-image'; we use that and fall back
// to a plain decode when the option is unsupported.

/** Decode a blob to an upright ImageBitmap, respecting EXIF orientation. */
export async function decodeUpright(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Older engines: option unsupported — decode without orientation handling.
    return createImageBitmap(blob);
  }
}
