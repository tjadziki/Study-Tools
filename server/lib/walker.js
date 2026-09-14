import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/** Files larger than this are never opened. */
export const MAX_BYTES = 25 * 1024 * 1024;

/** Extensions we can pull text out of. */
export const PARSEABLE = new Set(['.pdf', '.docx', '.pptx', '.md', '.txt', '.csv', '.html', '.htm']);

/**
 * Legacy binary Office formats. These are OLE compound files, not zips, so
 * jszip cannot open them — recorded as skipped with a reason rather than
 * failing the scan.
 */
export const LEGACY_OFFICE = new Set(['.ppt', '.doc', '.xls']);

/** Never descend into these. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.vscode', '.idea', 'StudyHub', 'scan-dump', '.obsidian',
]);

/**
 * Course-code folder pattern. Matches ME 548, ME548, me-548, HLTH101,
 * HLTH_101 — two to five letters, an optional separator, three digits.
 */
const COURSE_DIR = /^([A-Za-z]{2,5})[\s._-]*(\d{3})[\s._-]*(.*)$/;

/** 'ME 548' / 'me-548' -> 'ME548', the join key for matching. */
export function normaliseCode(s) {
  const m = String(s).trim().match(COURSE_DIR);
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2]}`;
}

/**
 * Find the course folders under root. Returns [{ dirName, absPath, code }].
 * Detection, not assumption: any directory whose name parses as a course code
 * counts, and unmatched ones are reported so nothing disappears silently.
 */
export async function findCourseFolders(root) {
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch (e) {
    return { folders: [], unmatched: [], error: e.message };
  }

  const folders = [];
  const unmatched = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const code = normaliseCode(e.name);
    if (code) folders.push({ dirName: e.name, absPath: path.join(root, e.name), code });
    else unmatched.push(e.name);
  }
  return { folders, unmatched, error: null };
}

/**
 * Walk a course folder recursively. Handles nested Assignments/ Lectures/
 * Labs/ and anything else. Returns a flat list of candidate files with their
 * stats — no hashing yet, so this stays cheap.
 */
export async function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      await walkFiles(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    if (e.name.startsWith('~$') || e.name.startsWith('.')) continue; // Office lock files

    const ext = path.extname(e.name).toLowerCase();
    let st;
    try {
      st = await fsp.stat(abs);
    } catch {
      continue;
    }

    let skipReason = null;
    if (st.size > MAX_BYTES) skipReason = `over ${Math.round(MAX_BYTES / 1048576)} MB`;
    else if (LEGACY_OFFICE.has(ext)) skipReason = `legacy ${ext} format — re-save as ${ext}x to include it`;
    else if (!PARSEABLE.has(ext)) skipReason = `unsupported type ${ext || '(none)'}`;

    out.push({
      path: abs,
      name: e.name,
      ext,
      size: st.size,
      mtime: st.mtime.toISOString(),
      skipReason,
    });
  }
  return out;
}

/** SHA-256 of file contents, streamed so a big PDF never lands in memory twice. */
export function hashFile(abs) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(abs);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}
