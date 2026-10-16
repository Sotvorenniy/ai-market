// Minimal YAML frontmatter parser for SKILL.md, agent and command files.
// Supports the subset those files use: scalars (plain, quoted, multi-line plain), inline lists [a, b],
// block lists (- a), block scalars (> and |) and one level of nested maps. Anything else is kept as a string.

const unquote = (value) => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
};

const scalar = (raw) => {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(',').map((item) => unquote(item.trim())).filter((item) => item !== '') : [];
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return unquote(value);
};

const indentOf = (line) => line.length - line.trimStart().length;

/**
 * @param {string} text file contents
 * @returns {{ data: Record<string, unknown>, body: string, error: string | null }}
 */
export function parseFrontmatter(text) {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized, error: null };
  const end = normalized.indexOf('\n---', 3);
  const closing = end === -1 ? -1 : normalized.slice(end + 4).match(/^[^\S\n]*(\n|$)/);
  if (end === -1 || !closing) return { data: {}, body: normalized, error: 'Frontmatter is not closed with "---".' };

  const lines = normalized.slice(4, end).split('\n');
  const body = normalized.slice(end + 4 + closing[0].length);
  const data = {};
  let error = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (indentOf(line) > 0) {
      error ??= `Unexpected indentation on line ${i + 2}.`;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):(?:\s+(.*)|\s*)$/.exec(line);
    if (!match) {
      error ??= `Cannot parse line ${i + 2}: "${line}".`;
      continue;
    }
    const [, key, rawValue = ''] = match;
    const value = rawValue.replace(/\s+#.*$/, '').trim();

    // Collect the indented lines that belong to this key.
    const block = [];
    while (i + 1 < lines.length && (lines[i + 1].trim() === '' || indentOf(lines[i + 1]) > 0)) block.push(lines[++i]);
    while (block.length && !block.at(-1).trim()) block.pop();

    if (/^[>|][+-]?$/.test(value)) {
      const minIndent = Math.min(...block.filter((l) => l.trim()).map(indentOf));
      const content = block.map((l) => l.slice(Number.isFinite(minIndent) ? minIndent : 0));
      data[key] = value.startsWith('>')
        ? content.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ').trim()
        : content.join('\n').trim();
    } else if (value === '' && block.length && block.every((l) => !l.trim() || l.trim().startsWith('- '))) {
      data[key] = block.filter((l) => l.trim()).map((l) => scalar(l.trim().slice(2)));
    } else if (value === '' && block.length) {
      const nested = {};
      for (const l of block) {
        const m = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(l);
        if (m) nested[m[1]] = scalar(m[2]);
      }
      data[key] = nested;
    } else if (block.length && !value.startsWith('"') && !value.startsWith("'") && !value.startsWith('[')) {
      // Plain scalar continued on following indented lines.
      data[key] = [value, ...block.map((l) => l.trim())].filter(Boolean).join(' ');
    } else {
      data[key] = scalar(value);
    }
  }
  return { data, body, error };
}
