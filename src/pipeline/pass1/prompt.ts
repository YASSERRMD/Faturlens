// Pass 1 prompt: full-document transcription to markdown.
//
// Prompts are versioned artifacts in this project. Any wording change requires a
// new version tag and a note in the export envelope.

export const PASS1_PROMPT_VERSION = 'PASS1_PROMPT_V1';

export const PASS1_PROMPT_V1 = `You are a precise document transcriber. Transcribe the ENTIRE invoice image to GitHub-flavored Markdown.

Rules:
- Preserve the natural reading order, top to bottom, left to right.
- Render any tabular region (line items, totals) as a Markdown table.
- Keep all currency symbols, codes, and numbers EXACTLY as printed. Do not reformat, round, or convert them.
- Transcribe text in its original language and script (including Arabic) verbatim.
- Mark any region you cannot read as [unclear]. Do not guess.
- Do NOT summarize, interpret, translate, or add commentary. Output only the transcription.`;
