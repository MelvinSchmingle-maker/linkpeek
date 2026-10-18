import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * docs/x/capture-snippet.js is run by a person in DevTools, on a real X post. These tests run it on
 * SYNTHETIC markup, invented for the tests (no real post). They check what the output can and cannot
 * contain. They do not show what X's real markup looks like.
 */
const source = readFileSync(join(process.cwd(), 'docs/x/capture-snippet.js'), 'utf8');

/** Runs the snippet with `selector` as $0 (the element selected in DevTools) on the given markup. */
function run(html: string, selector: string | null, pathname = '/someuser/status/12345') {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...Array.from(parsed.body.childNodes));
  const selected = selector ? document.querySelector(selector) : null;
  const logged: string[] = [];
  const fn = new Function('$0', 'location', 'console', `return (${source.trim().replace(/;$/, '')})`) as (
    selectedElement: Element | null,
    loc: Location,
    c: { log: (s: string) => void },
  ) => Record<string, unknown>;
  const result = fn(selected, { hostname: 'x.com', pathname, href: `https://x.com${pathname}` } as Location, {
    log: (s: string) => logged.push(s),
  });
  return { result, printed: logged.join('\n'), logCalls: logged.length };
}

const POST = `
  <article data-testid="tweet">
    <div data-testid="tweetText">
      <span>PRIVATE WORDS in this post, about a flood</span>
      <a href="https://t.co/AbC123" title="PRIVATE TITLE" data-a="javascript:alert(1)" data-b="https://user:pw@evil.example/x" data-expanded-url="https://news.example/reports/2026/flood?token=SECRET&utm_source=x" data-note="not a web address">news.example/reports/2026/flood</a>
    </div>
    <a href="https://x.com/someuser/status/12345">x.com/someuser/status/12345</a>
    <div data-testid="tweetPhoto"><a href="https://t.co/Zz9Q1">photo</a></div>
  </article>`;

describe('the X capture snippet (synthetic markup)', () => {
  it('reads the selected link and reports its hostname, attribute names and ancestors', () => {
    const { result } = run(POST, 'a[href="https://t.co/AbC123"]');
    expect(result.status).toBe('ok');
    const anchor = result.anchor as { hostname: string; isTco: boolean; attributeNames: string[]; ancestors: Array<{ tag: string; testId: string | null }> };
    expect(anchor.hostname).toBe('t.co');
    expect(anchor.isTco).toBe(true);
    expect(anchor.attributeNames).toEqual(expect.arrayContaining(['href', 'title', 'data-expanded-url']));
    expect(anchor.ancestors.map((a) => a.tag)).toEqual(['div', 'article']);
    expect(anchor.ancestors.at(-1)).toEqual({ tag: 'article', testId: 'tweet' });
  });

  it('identifies the candidate destination by its hostname only, from an attribute', () => {
    const { result } = run(POST, 'a[href="https://t.co/AbC123"]');
    expect(result.candidateDestinations).toEqual(
      expect.arrayContaining([{ attribute: 'data-expanded-url', on: 'a', hostname: 'news.example', isXHost: false }]),
    );
  });

  it('never shows the page path, the account name, the post ID, a query string or a token', () => {
    const { printed } = run(POST, 'a[href="https://t.co/AbC123"]', '/someuser/status/12345');
    expect(printed).not.toContain('someuser');
    expect(printed).not.toContain('12345');
    expect(printed).not.toContain('SECRET');
    expect(printed).not.toContain('token');
    expect(printed).not.toContain('utm_source');
    expect(printed).not.toContain('/reports');
  });

  it('never shows visible text or raw attribute values', () => {
    const { printed } = run(POST, 'a[href="https://t.co/AbC123"]');
    expect(printed).not.toContain('PRIVATE WORDS');
    expect(printed).not.toContain('PRIVATE TITLE');
    expect(printed).not.toContain('flood');
    expect(printed).not.toMatch(/https?:\/\//);
  });

  it('keeps only valid web hostnames: no javascript:, no credentials, no non-address values', () => {
    const { result, printed } = run(POST, 'a[href="https://t.co/AbC123"]');
    const hosts = (result.candidateDestinations as Array<{ hostname: string }>).map((c) => c.hostname);
    expect(hosts).toEqual(['news.example']);
    expect(printed).not.toContain('evil');
    expect(printed).not.toContain('javascript');
    expect(printed).not.toContain('pw');
  });

  it('does not inspect other posts on the page', () => {
    const twoPosts = `${POST}
      <article data-testid="tweet">
        <a href="https://decoy.example/story" data-decoy="https://decoy.example/y">decoy story</a>
        <div data-decoy-note="https://decoy-note.example/">note</div>
      </article>`;
    const { result, printed } = run(twoPosts, 'a[href="https://t.co/AbC123"]');
    expect(printed).not.toContain('decoy');
    expect((result.post as { linkCount: number }).linkCount).toBe(3);
  });

  it('reports an ambiguous selection instead of guessing, and prints no hostnames', () => {
    const ambiguous = `<article data-testid="tweet"><span id="text">Two links here</span>
      <a href="https://news.example/a">one</a><a href="https://other.example/b">two</a></article>`;
    const { result, printed } = run(ambiguous, '#text');
    expect(result.status).toBe('ambiguous');
    expect(result.externalLinksInPost).toBe(2);
    expect(printed).not.toContain('news.example');
    expect(printed).not.toContain('other.example');
  });

  it('reports not-found when nothing is selected, or the selection is not in a post', () => {
    expect(run(POST, null).result.status).toBe('not-found');
    expect(run('<div><a href="https://news.example/">outside any post</a></div>', 'a').result.status).toBe('not-found');
  });

  it('marks a link inside a media container by its test ID, not by its address', () => {
    const { result } = run(POST, 'a[href="https://t.co/Zz9Q1"]');
    const anchor = result.anchor as { ancestors: Array<{ testId: string | null }> };
    expect(anchor.ancestors.map((a) => a.testId)).toContain('tweetPhoto');
  });

  it('prints exactly one line of output', () => {
    expect(run(POST, 'a[href="https://t.co/AbC123"]').logCalls).toBe(1);
  });
});

describe('the capture snippet is offline and reads only the selected post', () => {
  it('makes no network request, stores nothing, and uses no outside code', () => {
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|import\(|localStorage|sessionStorage|indexedDB|cookie|postMessage/);
  });

  it('reads no page address, and no page text, and does not search the whole document', () => {
    expect(source).not.toMatch(/location\.(pathname|search|hash|href)/);
    expect(source).not.toMatch(/\bdocument\./);
    // Attribute values are read to validate a hostname, but never printed (see the tests above).
    expect(source).not.toMatch(/textContent|innerText|innerHTML/);
  });
});
