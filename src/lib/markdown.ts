// Minimal, dependency-free Markdown → HTML renderer. Scope is deliberately
// small (headings, bold, tables, paragraphs) — just enough to render Pass 1
// transcripts. Input is HTML-escaped first, so the output is safe to inject.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.includes('|');
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderTable(rows: string[]): string {
  const [header, ...rest] = rows;
  if (header === undefined) return '';
  const body = rest.filter((r) => !isSeparatorRow(r));
  const head = `<thead><tr>${splitCells(header)
    .map((c) => `<th>${inline(c)}</th>`)
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${body
    .map(
      (row) =>
        `<tr>${splitCells(row)
          .map((c) => `<td>${inline(c)}</td>`)
          .join('')}</tr>`,
    )
    .join('')}</tbody>`;
  return `<table>${head}${tbody}</table>`;
}

/** Render a small subset of Markdown to safe HTML. */
export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (isTableRow(line)) {
      const block: string[] = [];
      while (i < lines.length && isTableRow(lines[i] ?? '')) {
        block.push(lines[i] ?? '');
        i += 1;
      }
      out.push(renderTable(block));
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      out.push(`<h${String(level)}>${inline(heading[2] ?? '')}</h${String(level)}>`);
      i += 1;
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }

  return out.join('\n');
}
