// sha256 of bytes, hex-encoded. Uses Web Crypto (available in browsers and Node).

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer: ArrayBuffer =
    bytes instanceof Uint8Array
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : bytes;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
