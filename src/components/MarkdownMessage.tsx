import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded-lg bg-[#00F0FF]/12 border border-[#00F0FF]/30 text-[#67F8FF] font-mono text-[12px]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      return (
        <em key={idx} className="italic text-[#D6E0F5]">
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
          className="p-3.5 bg-[#04060D] border border-[#00F0FF]/25 text-[#E8EEF8] rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className="border-cyan-400/20 my-2" />);
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
              ? 'text-base font-bold text-white pt-1'
              : level === 2
                ? 'text-sm font-bold text-[#67F8FF] pt-1'
                : 'text-xs font-bold text-[#DF9EFF] pt-1'
          }
        >
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote (clean rounded inset, no thick left bar)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="px-3.5 py-2.5 border border-violet-400/30 bg-violet-500/10 text-xs text-[#D6E0F5] rounded-2xl"
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
          className={`space-y-1.5 pl-4 text-sm text-[#D6E0F5] ${
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
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="overflow-x-auto border border-cyan-400/25 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B1224] border-b border-cyan-400/20 text-[#67F8FF] font-semibold">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3.5 py-2.5 whitespace-nowrap">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-400/10 text-[#D6E0F5]">
              {rows.map((r, rIdx) => (
                <tr key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 align-top">
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
      <p key={`p-${i}`} className="text-sm text-[#D6E0F5] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2.5">{blocks}</div>;
}
