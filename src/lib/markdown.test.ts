import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from './markdown.ts';

describe('renderMarkdownToHtml', () => {
  it('escapes HTML in content', () => {
    expect(renderMarkdownToHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(renderMarkdownToHtml('a & b')).toContain('a &amp; b');
  });

  it('renders headings', () => {
    expect(renderMarkdownToHtml('# Invoice')).toBe('<h1>Invoice</h1>');
    expect(renderMarkdownToHtml('### Total')).toBe('<h3>Total</h3>');
  });

  it('renders bold inline', () => {
    expect(renderMarkdownToHtml('**Total**: 5')).toContain('<strong>Total</strong>');
  });

  it('renders a markdown table without the separator row', () => {
    const md = '| Item | Amount |\n| --- | --- |\n| Widget | 10.00 |';
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Item</th>');
    expect(html).toContain('<td>Widget</td>');
    expect(html).not.toContain('---');
  });

  it('wraps plain lines in paragraphs and skips blanks', () => {
    const html = renderMarkdownToHtml('hello\n\nworld');
    expect(html).toBe('<p>hello</p>\n<p>world</p>');
  });
});
