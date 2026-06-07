// Export filename convention: {vendor-slug}_{invoiceNumber}_{issueDate}.{ext}
// with an Arabic-safe slug fallback and -2/-3 collision suffixes.

export function slugify(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .toLowerCase();
  return ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export interface FilenameParts {
  vendorName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
}

/** Build the base filename (no extension) from invoice parts. */
export function baseFilename(parts: FilenameParts): string {
  const vendor = slugify(parts.vendorName ?? '') || 'vendor';
  const invoice = slugify(parts.invoiceNumber ?? '') || 'invoice';
  const date =
    parts.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(parts.issueDate)
      ? parts.issueDate
      : slugify(parts.issueDate ?? '') || 'undated';
  return `${vendor}_${invoice}_${date}`;
}

/** Build a filename with extension, suffixing -2/-3… on collision. */
export function uniqueFilename(parts: FilenameParts, ext: string, taken: Set<string>): string {
  const base = baseFilename(parts);
  let candidate = `${base}.${ext}`;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${String(counter)}.${ext}`;
    counter += 1;
  }
  taken.add(candidate);
  return candidate;
}
