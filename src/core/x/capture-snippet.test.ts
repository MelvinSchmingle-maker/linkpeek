import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The capture snippet (docs/x/capture-snippet.js) is pasted into a real X page's console. These tests run
 * it against SYNTHETIC markup, invented for the test. They check that it runs and that it prints
 * structure, not addresses, handles or long text. They do not show what X's real markup looks like.
 */
const source = readFileSync(join(process.cwd(), 'docs/x/capture-snippet.js'), 'utf8');

function runOn(html: string, path = '/someone/status/1') {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...Array.from(parsed.body.childNodes));
  const logged: string[] = [];
  const fn = new Function('document', 'location', 'console', `return ${source.trim().replace(/;$/, '')}`) as (
    d: Document,
    l: Location,
    c: { log: (s: string) => void },
  ) => Record<string, unknown>;
  const result = fn(document, { host: 'x.com', pathname: path, href: `https://x.com${path}` } as Location, {
    log: (s: string) => logged.push(s),
  });
  return { result, printed: logged.join('\n') };
}

const SYNTHETIC_POST = `
  <article data-testid="tweet">
    <div data-testid="tweetText">
      <span>Read this report: <a href="https://t.co/AbC123" title="Report" data-expanded-url="https://news.example/reports/2026/flood?utm_source=x&token=SECRET">news.example/reports/2026/flood</a></span>
    </div>
  </article>
  <article data-testid="tweet">
    <div data-testid="tweetText">
      <a href="https://x.com/somebody/status/999">x.com/somebody/status/999</a> @somebody said hello to everyone reading this long sentence about the weather
    </div>
  </article>
  <article data-testid="tweet">
    <a href="https://t.co/Zz9Q1">photo</a>
  </article>
`;

describe('the X capture snippet (synthetic markup)', () => {
  it('runs and counts the links and the t.co links', () => {
    const { result } = runOn(SYNTHETIC_POST);
    expect(result.linkCount).toBe(3);
    expect(result.tcoCount).toBe(2);
    expect(result.tcoAttributeNames).toEqual(expect.arrayContaining(['data-expanded-url', 'href', 'title']));
  });

  it('records the destination host of data-expanded-url, and never its path or query string', () => {
    const { result, printed } = runOn(SYNTHETIC_POST);
    const found = (result.tcoUrlAttributes as Array<{ name: string; host: string }>).find((a) => a.name === 'data-expanded-url');
    expect(found?.host).toBe('news.example');
    expect(printed).not.toContain('/reports/2026/flood');
    expect(printed).not.toContain('SECRET');
    expect(printed).not.toContain('utm_source');
  });

  it('keeps handles and long text out of the output', () => {
    const { printed } = runOn(SYNTHETIC_POST);
    expect(printed).not.toContain('@somebody');
    expect(printed).not.toContain('said hello to everyone reading this long sentence');
    expect(printed).not.toContain('/somebody/status/999');
  });

  it('records the page only as its host and a masked path', () => {
    const { result } = runOn(SYNTHETIC_POST, '/someone/status/1234567890');
    expect(result.page).toEqual({ host: 'x.com', path: 'someone/…/…' });
  });
});
