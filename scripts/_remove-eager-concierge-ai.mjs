// One-shot: remove eager <script src="js/concierge-ai-modal.js..."> from all HTMLs.
// concierge-modal.js already lazy-loads it on first AI button click.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'dist', 'temporary screenshots', 'investor-deck']);
const RE = /\s*<script src="\/?js\/concierge-ai-modal\.js(?:\?[^"]*)?"[^>]*><\/script>\s*\n?/g;

let touched = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.html')) continue;
    const orig = readFileSync(p, 'utf8');
    if (!RE.test(orig)) continue;
    RE.lastIndex = 0;
    const next = orig.replace(RE, '\n');
    if (next !== orig) { writeFileSync(p, next); touched++; console.log('  -', p.replace(ROOT, '.')); }
  }
}
walk(ROOT);
console.log(`\nDone. ${touched} file(s) updated.`);
