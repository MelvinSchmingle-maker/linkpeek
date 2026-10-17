/**
 * Reading mode (Part 12): the article's own paragraphs, in a clean panel on
 * the page, opened from a card. LinkPeek draws the panel, in its own shadow
 * root, so the page's CSS can't change it. The text goes in as plain text,
 * never as markup. Nothing is kept: closing the panel forgets it.
 */
import { HOST_ATTR } from './card';

/** Closed in the shipped build, as the card is. Open for automated tests. */
const SHADOW_MODE: ShadowRootMode = __E2E__ ? 'open' : 'closed';

export interface ReaderContent {
  title: string;
  url: string;
  /** The article's paragraphs, in reading order. Empty when the article couldn't be read again. */
  paragraphs: string[];
}

const CSS = `
  :host { all: initial; }
  .scrim { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0, 0, 0, 0.55); display: flex; align-items: flex-start; justify-content: center; padding: 24px 12px; box-sizing: border-box; font: 16px/1.6 system-ui, sans-serif; }
  .panel { background: #fff; color: #161a1f; max-width: 680px; width: 100%; max-height: calc(100vh - 48px); overflow: auto; border-radius: 10px; padding: 20px 24px 24px; box-sizing: border-box; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
  .top { display: flex; align-items: center; gap: 12px; }
  h2 { font-size: 20px; line-height: 1.3; margin: 0 0 8px; flex: 1; }
  .close { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: #eef1f4; color: #161a1f; font-size: 14px; }
  .close:focus-visible, .source:focus-visible { outline: 2px solid #2b6cb0; outline-offset: 2px; }
  .note { font-size: 13px; color: #5a6470; margin: 0 0 16px; }
  p.para { margin: 0 0 14px; }
  .source { font-size: 14px; color: #2b6cb0; }
  .empty { color: #5a6470; }
  @media (prefers-color-scheme: dark) {
    .panel { background: #1b1f24; color: #e8ecf0; }
    .close { background: #2c3138; color: #e8ecf0; }
    .note, .empty { color: #a7b0ba; }
    .source { color: #7cb3f0; }
  }
`;

/** Opens the reading panel. Returns a function that closes it. */
export function openReader(doc: Document, content: ReaderContent, onClose: () => void): () => void {
  const host = doc.createElement('div');
  host.setAttribute(HOST_ATTR, 'reader');
  const root = host.attachShadow({ mode: SHADOW_MODE });
  const style = doc.createElement('style');
  style.textContent = CSS;

  const scrim = doc.createElement('div');
  scrim.className = 'scrim';
  const panel = doc.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Reading mode');

  const top = doc.createElement('div');
  top.className = 'top';
  const title = doc.createElement('h2');
  title.textContent = content.title;
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close reading mode');
  top.append(title, close);

  const note = doc.createElement('p');
  note.className = 'note';
  note.textContent = "The article's own text, read again just now. Nothing is kept when you close this.";

  const body = doc.createElement('div');
  if (content.paragraphs.length) {
    for (const text of content.paragraphs) {
      const p = doc.createElement('p');
      p.className = 'para';
      p.textContent = text;
      body.append(p);
    }
  } else {
    const p = doc.createElement('p');
    p.className = 'empty';
    p.textContent = "Couldn't read the article text again. The site may have changed or asked for a check.";
    body.append(p);
  }

  const source = doc.createElement('a');
  source.className = 'source';
  source.href = content.url;
  source.rel = 'noopener noreferrer';
  source.textContent = 'Open the original article';

  panel.append(top, note, body, source);
  scrim.append(panel);
  root.append(style, scrim);

  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', onKey, true);
    host.remove();
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish();
    }
  };
  close.addEventListener('click', finish);
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) finish();
  });
  doc.addEventListener('keydown', onKey, true);
  doc.body.append(host);
  close.focus({ preventScroll: true });
  return finish;
}
