/**
 * Tiny static server for test-pages/, used by the Playwright tests and for
 * trying the extension by hand: node scripts/serve-test-pages.mjs
 * Serves on http://127.0.0.1:4173 only (never on your network).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../test-pages/', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  const file = join(root, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Test pages on http://127.0.0.1:${port}`));
