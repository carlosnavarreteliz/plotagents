// Markdown → HTML, sin dependencias, para el sitio de documentación.
// Cubre lo que usan docs/*.md y AGENTS.md: títulos, párrafos, listas, tablas
// de GitHub, bloques de código (con resaltado), citas y elementos en línea.

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Ids de títulos al estilo de GitHub: "Common options" → "common-options". */
export function headingId(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
}

// ── Resaltado de código ────────────────────────────────────────────────────
const JS_KW = new Set(['import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'await', 'async', 'new', 'for', 'of', 'in', 'default', 'typeof']);
const JS_LIT = new Set(['true', 'false', 'null', 'undefined']);

function tokens(code, rules) {
  let out = '', last = 0, m;
  const all = new RegExp(rules.map(([, r]) => `(${r.source})`).join('|'), 'g');
  while ((m = all.exec(code))) {
    if (m.index > last) out += esc(code.slice(last, m.index));
    const i = m.slice(1).findIndex((g) => g !== undefined);
    const cls = typeof rules[i][0] === 'function' ? rules[i][0](m[0]) : rules[i][0];
    out += cls ? `<span class="t-${cls}">${esc(m[0])}</span>` : esc(m[0]);
    last = all.lastIndex;
    if (m[0] === '') all.lastIndex++;
  }
  return out + esc(code.slice(last));
}

function hlJS(code) {
  return tokens(code, [
    ['c', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['s', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/],
    ['p', /\b[A-Za-z_$][\w$]*(?=\s*:(?!:))/],
    [(w) => (JS_KW.has(w) ? 'k' : JS_LIT.has(w) ? 'n' : null), /\b[A-Za-z_$][\w$]*\b/],
    ['n', /\b\d[\d_.]*(?:e[+-]?\d+)?\b/],
  ]);
}

function hlBash(code) {
  return code.split('\n').map((line) => tokens(line, [
    ['c', /(?:^|\s)#.*$/],
    ['s', /'[^']*'|"[^"]*"/],
    ['k', /^(?:npx|npm|node|cat|curl)\b/],
    ['p', /\s--?[\w-]+/],
  ])).join('\n');
}

function hlHTML(code) {
  // El JavaScript dentro de <script> se resalta como JS.
  return code.split(/(<script[^>]*>[\s\S]*?<\/script>)/).map((part) => {
    const m = /^(<script[^>]*>)([\s\S]*?)(<\/script>)$/.exec(part);
    if (m) return hlTags(m[1]) + hlJS(m[2]) + hlTags(m[3]);
    return hlTags(part);
  }).join('');
}

function hlTags(code) {
  return tokens(code, [
    ['c', /<!--[\s\S]*?-->/],
    ['k', /<\/?[\w-]+|\/?>/],
    ['s', /"[^"]*"/],
    ['p', /\b[\w-]+(?==)/],
  ]);
}

export function highlight(code, lang) {
  if (['js', 'javascript', 'ts', 'json', 'jsonc'].includes(lang)) return hlJS(code);
  if (['bash', 'sh', 'shell'].includes(lang)) return hlBash(code);
  if (['html', 'xml', 'svg'].includes(lang)) return hlHTML(code);
  return esc(code);
}

// ── En línea ───────────────────────────────────────────────────────────────
function inline(text, opts) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${esc(opts.link(src, 'img'))}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = opts.link(href.replace(/&amp;/g, '&'), 'a');
    const ext = /^https?:/.test(url) ? ' rel="noopener"' : '';
    return `<a href="${esc(url)}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i].replace(/\\\|/g, '|'))}</code>`);
  return s;
}

/** Divide una fila de tabla en celdas, respetando `\|`. */
function cells(line) {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (t[i] === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += t[i];
  }
  out.push(cur.trim());
  return out;
}

const isSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);

/**
 * Convierte Markdown a HTML.
 * opts.link(href, kind)   → reescribe enlaces e imágenes.
 * opts.afterHeading(level, text, id) → HTML extra tras un título.
 * Devuelve { html, title, toc: [{ level, text, id }] }.
 */
export function markdown(src, opts = {}) {
  const o = { link: (h) => h, afterHeading: () => '', ...opts };
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  const used = new Map();
  let title = '';
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '), o)}</p>`); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i]);
      const lang = fence[1] || 'text';
      out.push(`<div class="code" data-lang="${esc(lang)}"><pre><code>${highlight(body.join('\n'), lang)}</code></pre></div>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      const html = inline(h[2], o);
      let id = headingId(html);
      const n = used.get(id) || 0;
      used.set(id, n + 1);
      if (n) id += '-' + n;
      if (level === 1 && !title) { title = html.replace(/<[^>]+>/g, ''); out.push(`<h1 id="${id}">${html}</h1>`); continue; }
      if (level <= 3) toc.push({ level, html, id });
      out.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${html}</h${level}>` + o.afterHeading(level, h[2], id));
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c, o)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) items.push(m[3]);
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += ' ' + lines[i].trim();
        else break;
        i++;
      }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t, o)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      out.push(`<blockquote><p>${inline(q.join(' '), o)}</p></blockquote>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return { html: out.join('\n'), title, toc };
}
