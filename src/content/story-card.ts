/**
 * Builds the Story Search card's DOM from a StoryView. Same rules as the
 * preview card (card.ts): text only through textContent, never markup, and
 * links only to http(s) addresses. Source links open in a new tab, without
 * a referrer; the card never opens the original link by itself.
 */
import { MSG } from '../core/messages';
import { icon } from './svg';
import type { StoryView, ViewItem, ViewSection } from './story-view';

export interface StoryCardHandlers {
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

function el(tag: string, className = '', content?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function isWeb(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function refs(nums: number[]): HTMLElement {
  const wrap = el('span', 'refs');
  for (const n of nums) {
    const r = el('sup', 'ref', `[${n}]`);
    r.setAttribute('aria-label', MSG.story.sourceRef(n));
    wrap.append(r);
  }
  return wrap;
}

function itemNode(tag: 'p' | 'li', item: ViewItem): HTMLElement {
  const node = el(tag, 'claim');
  if (item.label) node.append(el('strong', 'detail-label', `${item.label}: `));
  node.append(document.createTextNode(item.text));
  if (item.refs.length) node.append(' ', refs(item.refs));
  return node;
}

function sectionNode(s: ViewSection): HTMLElement {
  const section = el('section', `story-section ${s.id}`);
  const id = `lp-story-${s.id}`;
  const heading = el('h3', 'story-heading', s.heading);
  heading.id = id;
  section.setAttribute('aria-labelledby', id);
  section.append(heading);
  if (s.note) section.append(el('p', 'story-section-note', s.note));
  if (s.kind === 'paragraph') {
    for (const item of s.items) section.append(itemNode('p', item));
  } else {
    const list = el('ul', s.kind === 'details' ? 'story-details' : 'story-list');
    for (const item of s.items) list.append(itemNode('li', item));
    section.append(list);
  }
  return section;
}

export function renderStoryCard(view: StoryView, href: string, handlers: StoryCardHandlers): HTMLElement {
  const card = el('div', 'card story');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', MSG.story.cardLabel);
  card.tabIndex = -1;

  const top = el('div', 'top');
  top.append(el('span', 'story-title', view.title));
  for (const t of view.tags) {
    const tag = el('span', `tag story-tag ${t.tone}`, t.text);
    tag.setAttribute('data-tone', t.tone);
    top.append(tag);
  }
  top.append(el('span', 'spacer'));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', MSG.close);
  close.title = MSG.close;
  close.append(icon('close'));
  close.addEventListener('click', handlers.onClose);
  top.append(close);
  card.append(top);

  const body = el('div', 'body story-body');
  body.setAttribute('aria-live', 'polite');
  body.setAttribute('aria-busy', String(view.busy));

  if (view.subject) {
    const subject = el('p', 'story-subject');
    if (view.subjectLabel) subject.append(el('span', 'story-subject-label', `${view.subjectLabel} `));
    subject.append(document.createTextNode(view.subject));
    body.append(subject);
  }

  if (view.stages) {
    const list = el('ol', 'story-stages');
    for (const s of view.stages) {
      const li = el('li', `stage ${s.state}`);
      li.setAttribute('data-state', s.state);
      if (s.state === 'active') li.append(el('span', 'spinner'));
      else li.append(el('span', 'stage-mark', s.state === 'done' ? '✓' : ''));
      li.append(el('span', 'stage-label', s.label));
      if (s.state !== 'todo') li.append(el('span', 'sr-only', ` (${s.state === 'done' ? MSG.story.stageDone : MSG.story.stageNow})`));
      if (s.state === 'active') li.setAttribute('aria-current', 'step');
      list.append(li);
    }
    body.append(list);
  }

  if (view.confirm) {
    const c = view.confirm;
    body.append(el('p', 'story-intro', c.intro));
    const dl = el('dl', 'story-preview');
    for (const l of c.lines) {
      const dt = el('dt', '', l.label);
      const dd = el('dd', '', l.text);
      if (l.from) dd.append(el('span', 'story-from', ` (${l.from})`));
      dl.append(dt, dd);
    }
    body.append(dl, el('p', 'story-not-sent', c.notSent));
    const actions = el('div', 'story-actions');
    actions.append(button('action story-go', c.go, handlers.onConfirm), button('secondary story-cancel', c.cancel, handlers.onCancel));
    body.append(actions);
  }

  if (view.message) body.append(el('p', 'message story-message', view.message));
  if (view.caution) {
    const caution = el('p', 'story-caution');
    caution.setAttribute('role', 'note');
    caution.textContent = view.caution;
    body.append(caution);
  }
  for (const s of view.sections) body.append(sectionNode(s));
  if (view.notes.length) {
    const notes = el('ul', 'story-notes');
    for (const n of view.notes) notes.append(el('li', '', n));
    body.append(notes);
  }

  if (view.sources.length) {
    const section = el('section', 'story-section sources');
    const heading = el('h3', 'story-heading', view.sourcesHeading ?? MSG.story.sources);
    heading.id = 'lp-story-sources';
    section.setAttribute('aria-labelledby', heading.id);
    const list = el('ol', 'story-sources');
    for (const s of view.sources) {
      const li = el('li', 'story-source') as HTMLLIElement;
      li.value = s.n;
      li.setAttribute('data-n', String(s.n));
      if (isWeb(s.url)) {
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.referrerPolicy = 'no-referrer';
        a.className = 'story-source-link';
        a.textContent = s.title;
        a.title = `${s.title} (${MSG.story.openSource})`;
        li.append(a);
      } else {
        li.append(el('span', 'story-source-link', s.title));
      }
      li.append(el('span', 'story-source-meta', s.meta));
      for (const t of s.tags) li.append(el('span', 'tag story-source-tag', t));
      list.append(li);
    }
    section.append(heading, list);
    body.append(section);
  }

  if (view.searchedFor) {
    const p = el('p', 'story-searched');
    p.append(el('span', 'story-searched-label', `${MSG.story.searchedFor} `), document.createTextNode(`“${view.searchedFor}”`));
    body.append(p);
  }
  if (view.setAside) body.append(el('p', 'story-set-aside', view.setAside));
  if (view.retry) body.append(button('action story-retry', view.retry, handlers.onRetry));
  if (view.footnote) body.append(el('p', 'story-footnote', view.footnote));
  card.append(body);

  if (!view.busy && !view.confirm && isWeb(href)) {
    const footer = el('div', 'footer');
    const open = document.createElement('a');
    open.className = 'open';
    open.href = href;
    open.rel = 'noopener noreferrer';
    open.textContent = view.openLabel;
    footer.append(open);
    card.append(footer);
  }
  return card;
}
