// Deterministic JSON repair ladder. Each step is pure and independently tested.
// On failure, returns the furthest stage reached so callers can reason about it.

export type RepairStage = 'extract-braces' | 'parse';

export type RepairResult =
  | { ok: true; value: unknown }
  | { ok: false; stage: RepairStage; message: string };

/** Step a: strip Markdown code fences and surrounding prose markers. */
export function stripFences(text: string): string {
  return text
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

/** Step b: extract the outermost balanced `{ … }` block, ignoring string contents. */
export function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // truncated / unbalanced
}

/** Step c: fix trailing commas, single quotes, and unquoted keys. */
export function normalizeSyntax(json: string): string {
  return json
    .replace(/,(\s*[}\]])/g, '$1') // trailing commas
    .replace(/'((?:[^'\\]|\\.)*)'/g, '"$1"') // single-quoted strings → double
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3'); // unquoted keys
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Run the full ladder: strip → extract → (parse | normalize → parse). */
export function repairJson(text: string): RepairResult {
  const stripped = stripFences(text);

  // Double-encoded: the whole payload is a JSON string that contains JSON.
  const asString = tryParse(stripped);
  if (typeof asString === 'string' && asString.trim().startsWith('{')) {
    const inner = repairJson(asString);
    if (inner.ok) return inner;
  }

  const block = extractBalancedObject(stripped);
  if (block === null) {
    return { ok: false, stage: 'extract-braces', message: 'No balanced JSON object found' };
  }

  let parsed = tryParse(block);
  if (parsed === undefined) parsed = tryParse(normalizeSyntax(block));

  // Handle a double-encoded payload: a JSON string that itself contains JSON.
  if (typeof parsed === 'string' && parsed.trim().startsWith('{')) {
    const inner = repairJson(parsed);
    if (inner.ok) return inner;
  }

  if (parsed === undefined) {
    return { ok: false, stage: 'parse', message: 'JSON.parse failed after normalization' };
  }
  return { ok: true, value: parsed };
}
