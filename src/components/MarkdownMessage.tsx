import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  // Split inline code, bold, and italic cleanly without dangerouslySetInnerHTML
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 mx-0.5 rounded bg-slate-100 text-slate-900 font-mono text-[12px]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-700">
          {tok.slice(1, -1)}
        </em>
      );
    }
    return tok;
  });
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <pre
          key={`code-${i}`}
          className="p-3 bg-slate-900 text-slate-100 rounded-md overflow-x-auto text-xs font-mono leading-relaxed"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className="border-slate-200 my-1" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push(
        <div
          key={`h-${i}`}
          className={
            level === 1
              ? 'text-base font-bold text-slate-900 pt-1'
              : level === 2
                ? 'text-sm font-bold text-slate-900 pt-1'
                : 'text-xs font-bold uppercase tracking-wide text-slate-700 pt-1'
          }
        >
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="pl-3 border-l-2 border-slate-300 text-xs text-slate-700 bg-slate-50 py-1.5 pr-2 rounded-r"
        >
          {quoteLines.map((ql, idx) => (
            <div key={idx}>{renderInline(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered or ordered list
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${i}`}
          className={`space-y-1 pl-4 text-sm text-slate-800 ${
            ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Pipe table
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|/.test(lines[i + 1])
    ) {
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(lines[i]);
      i += 2; // Skip header + separator row
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 whitespace-nowrap">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r, rIdx) => (
                <tr key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 align-top">
                      {renderInline(r[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-sm text-slate-800 leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2">{blocks}</div>;
}
