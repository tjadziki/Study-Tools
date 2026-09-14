// Text extraction. Every extractor returns { text, pages, warning } or throws.
// A throw is caught by the scanner, recorded against the file, and the scan
// carries on — one malformed PDF must never abort a term's worth of parsing.

import fsp from 'node:fs/promises';
import path from 'node:path';

/* ── PDF ─────────────────────────────────────────────────────────────────── */
// pdfjs-dist over pdf-parse: it exposes per-item x/y geometry, which is what
// makes multi-column syllabus tables come out in a sane reading order.

let pdfjsLib = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

export async function extractPdf(abs) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await fsp.readFile(abs));

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    // Quiet: broken font programs are extremely common in lecture slides and
    // are not worth a console line each.
    verbosity: 0,
  }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    let page;
    try {
      page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(layoutPage(content.items));
    } catch (e) {
      pages.push(`[page ${i} failed to extract: ${e.message}]`);
    } finally {
      try { page?.cleanup(); } catch { /* nothing to do */ }
    }
  }
  await doc.destroy();

  return {
    text: pages.join('\n\n─── page break ───\n\n'),
    pages: doc.numPages,
    warning: null,
  };
}

/**
 * Rebuild reading order from text-item geometry.
 *
 * Items arrive in PDF content-stream order, which for a two-column syllabus
 * interleaves the columns. Group items into lines by their y coordinate, then
 * split each line into columns on large horizontal gaps, so "Assignment 1 |
 * Friday of Week 5" survives as one line instead of two unrelated fragments.
 */
function layoutPage(items) {
  const Y_TOLERANCE = 2.5;   // same visual line
  const COL_GAP = 28;        // horizontal jump that reads as a new column

  const placed = items
    .filter((it) => typeof it.str === 'string')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
    }))
    .filter((it) => it.str.length > 0);

  if (!placed.length) return '';

  const lines = [];
  for (const it of placed) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Y_TOLERANCE);
    if (line) {
      line.items.push(it);
      line.y = (line.y * (line.items.length - 1) + it.y) / line.items.length;
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }

  lines.sort((a, b) => b.y - a.y); // PDF origin is bottom-left

  return lines
    .map((l) => {
      const sorted = l.items.sort((a, b) => a.x - b.x);
      let out = '';
      let prevEnd = null;
      for (const it of sorted) {
        if (prevEnd !== null) {
          const gap = it.x - prevEnd;
          if (gap > COL_GAP) out += '\t';
          else if (gap > 1 && !out.endsWith(' ')) out += ' ';
        }
        out += it.str;
        prevEnd = it.x + it.w;
      }
      return out.replace(/[ \t]+$/, '');
    })
    .filter((l) => l.trim().length)
    .join('\n');
}

/* ── DOCX ────────────────────────────────────────────────────────────────── */

export async function extractDocx(abs) {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.extractRawText({ path: abs });
  return {
    text: result.value || '',
    pages: null,
    warning: result.messages?.length ? `${result.messages.length} mammoth message(s)` : null,
  };
}

/* ── PPTX ────────────────────────────────────────────────────────────────── */
// A .pptx is a zip of slide XML. Pull <a:t> runs per slide, in slide order.

export async function extractPptx(abs) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await fsp.readFile(abs));

  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slides = [];
  for (const name of slideNames) {
    const xml = await zip.file(name).async('string');
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    // Paragraph boundaries carry the line structure a slide's bullets rely on.
    const text = runs.join(' ').replace(/\s+/g, ' ').trim();
    const n = name.match(/slide(\d+)\.xml/)[1];
    if (text) slides.push(`[slide ${n}]\n${text}`);
  }

  return {
    text: slides.join('\n\n'),
    pages: slideNames.length,
    warning: slideNames.length && !slides.length ? 'slides contained no text runs' : null,
  };
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

/* ── HTML ────────────────────────────────────────────────────────────────── */
// HLTH 101 is delivered entirely as LEARN HTML exports — its dates exist in no
// other format, so tag-stripped text is the only way to reach them.

export async function extractHtml(abs) {
  const raw = await fsp.readFile(abs, 'utf8');

  let body = raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');

  // Table rows are collapsed to ONE line each, cells separated by tabs.
  //
  // This matters more than it looks. HLTH 101's schedule is a table whose row
  // reads "Week 4 | Psychological Health | Behaviour Change Part 1 | Friday,
  // October 2, 2026 | 15%". Cells contain <p> tags, so treating those as line
  // breaks scatters the deliverable, its date and its weight onto separate
  // lines and the date extractor loses the context that makes it a deadline.
  body = body.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
    const line = row
      .replace(/<\/t[dh]\s*>/gi, '\t')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s*\t\s*/g, '\t')
      .replace(/[^\S\t]+/g, ' ')
      .replace(/\t+$/, '')
      .trim();
    return `\n${line}\n`;
  });

  const text = body
    .replace(/<\/?(p|div|br|li|h[1-6]|section|article|table|thead|tbody)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return {
    text: decodeHtmlEntities(text)
      .replace(/[^\S\n\t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    pages: null,
    warning: null,
  };
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&rsquo;/gi, '’')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/gi, '&');
}

/* ── plain text ──────────────────────────────────────────────────────────── */

export async function extractPlain(abs) {
  const text = await fsp.readFile(abs, 'utf8');
  return { text, pages: null, warning: null };
}

/* ── dispatch ────────────────────────────────────────────────────────────── */

export async function extractText(abs) {
  const ext = path.extname(abs).toLowerCase();
  switch (ext) {
    case '.pdf': return extractPdf(abs);
    case '.docx': return extractDocx(abs);
    case '.pptx': return extractPptx(abs);
    case '.html':
    case '.htm': return extractHtml(abs);
    case '.md':
    case '.txt':
    case '.csv': return extractPlain(abs);
    default:
      throw new Error(`no extractor for ${ext}`);
  }
}
