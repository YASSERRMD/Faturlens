// Pass 2 prompt: schema-constrained JSON extraction. Versioned artifact.

export const PASS2_PROMPT_VERSION = 'PASS2_PROMPT_V1';

export const PASS2_PROMPT_V1 = `You extract structured data from an invoice. You are given the invoice image(s) and a Markdown transcript.

Output ONLY a single JSON object — no prose, no code fences — matching this shape:

{
  "vendor": { "name": string|null, "address": string|null, "trn": string|null, "phone": string|null, "email": string|null },
  "buyer":  { "name": string|null, "address": string|null, "trn": string|null, "phone": string|null, "email": string|null } | null,
  "invoiceNumber": string|null,
  "issueDate": "YYYY-MM-DD"|null,
  "dueDate": "YYYY-MM-DD"|null,
  "currency": string|null,            // ISO 4217, e.g. "AED"
  "lineItems": [ { "description": string|null, "quantity": number|null, "unitPrice": number|null, "amount": number|null, "taxRate": number|null } ],
  "subtotal": number|null,
  "taxAmount": number|null,
  "total": number|null,
  "paymentTerms": string|null,
  "notes": string|null,
  "_uncertain": [ string ]            // field paths you are unsure about, e.g. "subtotal"
}

Rules:
- Use null for any field not present. NEVER invent a value.
- Copy numbers EXACTLY as printed (no rounding); output them as JSON numbers.
- Normalize dates to YYYY-MM-DD.
- List the path of any value you are uncertain about in "_uncertain".`;

/** Build a corrective re-prompt that appends the validator's complaint. */
export function correctivePrompt(basePrompt: string, errors: string): string {
  return `${basePrompt}\n\n## Your previous output was invalid\n${errors}\n\nReturn corrected JSON only.`;
}
