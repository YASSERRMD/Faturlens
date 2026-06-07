// Pinned model manifest for LiquidAI/LFM2.5-VL-1.6B-ONNX.
//
// The WebGPU-supported recipe is: FP16 vision encoder (embed_images) + Q4
// decoder + FP16 token embeddings. Filenames, byte sizes, and sha256 values
// were captured from the Hugging Face repo file listing at build time (the
// sha256 for LFS files is the blob's git-lfs oid). Do NOT guess these at
// runtime — if Liquid republishes artifacts, repin here and bump CACHE_NAME.

export type ArtifactRole = 'encoder' | 'decoder' | 'embeddings' | 'tokenizer' | 'config';

export interface ManifestEntry {
  /** Repo-relative path, also used as the cache key suffix. */
  path: string;
  /** Expected byte size — the primary integrity check. */
  bytes: number;
  /** git-lfs sha256 oid, where the file is stored in LFS. */
  sha256?: string;
  role: ArtifactRole;
}

export const MODEL_REPO = 'LiquidAI/LFM2.5-VL-1.6B-ONNX';
export const MODEL_REVISION = 'main';

/** Cache API namespace. Bump the version suffix if the manifest changes. */
export const CACHE_NAME = 'faturlens-model-v1';

export const MODEL_MANIFEST: readonly ManifestEntry[] = [
  // Vision encoder (FP16) — graph + external weights.
  {
    path: 'onnx/embed_images_fp16.onnx',
    bytes: 245704,
    sha256: '2a7b59cf6a8c635cd13a9fb8eb17e85d4e127bb96ba3fdc55f4729d8e864ddd4',
    role: 'encoder',
  },
  {
    path: 'onnx/embed_images_fp16.onnx_data',
    bytes: 852570592,
    sha256: '8054413051a026379524506513c30489dea5ba8830a8d5f7a1bb6fd3d6221041',
    role: 'encoder',
  },
  // Decoder (Q4) — graph + external weights.
  {
    path: 'onnx/decoder_q4.onnx',
    bytes: 169018,
    sha256: '44bbb840012f64393e74c6c3fa48d22c2d03317a71e3de882b1115daab028480',
    role: 'decoder',
  },
  {
    path: 'onnx/decoder_q4.onnx_data',
    bytes: 1217650688,
    sha256: '144e30048e0de1af8b9524fc4bdca99286090ff92c0f12792ccedd31804f2d73',
    role: 'decoder',
  },
  // Token embeddings (FP16) — graph + external weights.
  {
    path: 'onnx/embed_tokens_fp16.onnx',
    bytes: 573,
    sha256: 'de3dd76a0d69bc47dc96c0ee086e1f97b28a892e0dee36c2ff5475456ab8b258',
    role: 'embeddings',
  },
  {
    path: 'onnx/embed_tokens_fp16.onnx_data',
    bytes: 268435456,
    sha256: '9f7fe1eac2569a8be47a56bb721fdb8d98bc34ce5edc5fce073b5db7c0b1785d',
    role: 'embeddings',
  },
  // Tokenizer.
  { path: 'tokenizer.json', bytes: 4733383, role: 'tokenizer' },
  { path: 'tokenizer_config.json', bytes: 605, role: 'tokenizer' },
  // Model + processor config.
  { path: 'config.json', bytes: 2376, role: 'config' },
  { path: 'processor_config.json', bytes: 1110, role: 'config' },
  { path: 'generation_config.json', bytes: 131, role: 'config' },
  { path: 'chat_template.jinja', bytes: 434, role: 'config' },
];

/** Resolve a manifest path to its Hugging Face CDN download URL. */
export function hfUrl(path: string): string {
  return `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/${path}`;
}

/** Total bytes across every manifest entry. */
export function totalManifestBytes(): number {
  return MODEL_MANIFEST.reduce((sum, entry) => sum + entry.bytes, 0);
}

/** Look up a manifest entry by its path. */
export function findManifestEntry(path: string): ManifestEntry | undefined {
  return MODEL_MANIFEST.find((entry) => entry.path === path);
}
