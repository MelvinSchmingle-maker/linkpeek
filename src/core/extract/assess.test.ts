import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessFetchError, assessHtml, assessPdf, FULL_ARTICLE_WORDS } from './assess';
import { extractHtml } from './html';
import { firstSentence, limitWords } from './sentences';

// Tests run from the project folder.
const fixture = (name: string) => readFileSync(join(process.cwd(), 'test-pages/articles', name), 'utf8');
const SITE = 'http://127.0.0.1:4173';

/** Read a fixture as if it had been fetched from `path` (optionally after a redirect to `finalPath`). */
function judge(name: string, opts: { path?: string; finalPath?: string; status?: number } = {}) {
  const html = fixture(name);
  const requestedUrl = `${SITE}${opts.path ?? `/articles/${name}`}`;
  const finalUrl = opts.finalPath ? `${SITE}${opts.finalPath}` : requestedUrl;
  return assessHtml({ requestedUrl, finalUrl, status: opts.status ?? 200 }, html, extractHtml(html, finalUrl));
}

describe('reading real article layouts', () => {
  for (const name of ['cycle-lanes.html', 'library-review.html', 'tomatoes.html']) {
    it(`${name}: full article, first sentence, enough words`, () => {
      const a = judge(name);
      expect(a.evidence).toBe('full');
      expect(a.failure).toBeUndefined();
      expect(a.extract?.wordCount).toBeGreaterThanOrEqual(FULL_ARTICLE_WORDS);
      expect(a.extract?.firstSentence.split(' ').length).toBeGreaterThanOrEqual(6);
      // Menus, footers and "Most read" boxes are not the article.
      expect(a.extract?.firstSentence).not.toMatch(/Home|Privacy|Most read|Log in/);
    });
  }

  it('reads the publisher, dates and title from the page metadata', () => {
    const a = judge('cycle-lanes.html');
    expect(a.source).toMatchObject({ publisher: 'The Millbrook Gazette', published: '2026-10-13T09:00:00Z', modified: '2026-10-13T11:30:00Z' });
    expect(a.extract?.title).toBe('Council approves protected cycle lanes for High Street');
    expect(a.extract?.firstSentence).toMatch(/^Millbrook council has approved two kilometres/);
  });
});

describe('the opening sentence, on layouts the live check tripped over', () => {
  it.each([
    // BBC News: the story is split into identical blocks, and Readability starts at the biggest one.
    ['split-blocks.html', 'The Old Mill footbridge reopened on Tuesday morning'],
    // Wikipedia: an infobox table and [note 1] markers come before the first sentence.
    ['infobox.html', 'The Millbrook terrier, also called the mill dog, is a small'],
    // GOV.UK: a "Press release" label sits above the first sentence.
    ['labelled.html', 'Market traders will be able to renew stall licences online'],
    // The Guardian: a standfirst comes first, but it's laid out differently from the story.
    ['standfirst.html', 'The first time I stood in the shallow end of Millbrook baths'],
  ])('%s starts with the story itself', (name, opening) => {
    const a = judge(name);
    expect(a.evidence).toBe('full');
    expect(a.extract?.firstSentence.startsWith(opening), a.extract?.firstSentence).toBe(true);
  });

  it('never starts with a video caption, a "turn on JavaScript" message or a table cell', () => {
    for (const name of ['split-blocks.html', 'infobox.html']) {
      expect(judge(name).extract?.firstSentence).not.toMatch(/Watch:|enable JavaScript|Origin|withers/);
    }
  });
});

describe('not enough for the full article', () => {
  it('a short item with a description is a preview, never a full article', () => {
    const a = judge('short-news.html');
    expect(a.evidence).toBe('partial');
    expect(a.preview).toBe('The Saturday market returns this weekend with twenty stalls.');
    expect(a.extract).toBeUndefined();
  });

  it('a page with only metadata is a preview from its description', () => {
    const a = judge('meta-only.html');
    expect(a.evidence).toBe('partial');
    expect(a.preview).toMatch(/public meeting on 4 November/);
  });

  it('a page with nothing readable says the text could not be found', () => {
    const a = judge('nothing.html');
    expect(a.evidence).toBe('unavailable');
    expect(a.failure).toBe('extraction-failed');
  });
});

describe('failures are never treated as content', () => {
  it('a robot check (Cloudflare style, status 503) is a bot challenge, not a server error', () => {
    const a = judge('challenge.html', { path: '/challenge', status: 503 });
    expect(a.failure).toBe('bot-challenge');
    expect(a.evidence).toBe('unavailable');
    expect(a.preview).toBeUndefined();
  });

  it('being sent to a login page is a login wall, with no preview borrowed from the login page', () => {
    const a = judge('login.html', { path: '/redirect-login', finalPath: '/accounts/login?next=%2Fmembers%2Fstory' });
    expect(a.failure).toBe('login-wall');
    expect(a.preview).toBeUndefined();
  });

  it('being sent to a login page that answers "403" is still a login wall (Reddit does this)', () => {
    const a = judge('login.html', { path: '/r/some-forum/', finalPath: '/login/?dest=%2Fr%2Fsome-forum%2F', status: 403 });
    expect(a.failure).toBe('login-wall');
    expect(a.preview).toBeUndefined();
    expect(a.source).toBeUndefined();
  });

  it('a login form with little text, at the article address, is a login wall', () => {
    expect(judge('login.html').failure).toBe('login-wall');
  });

  it('a page the publisher marks as not free is a paywall: description only, even though the full text is in the HTML', () => {
    const a = judge('paywall.html');
    expect(a.failure).toBe('paywall');
    expect(a.evidence).toBe('partial');
    expect(a.preview).toBe('Members only: a look at the draft budget for next year.');
    expect(a.extract).toBeUndefined();
    // Nothing from the paid body leaks into what LinkPeek shows.
    expect(JSON.stringify(a)).not.toMatch(/Councillors voted seven to five/);
  });

  it('an empty JavaScript app shell needs JavaScript, with its description as a preview', () => {
    const a = judge('js-only.html');
    expect(a.failure).toBe('js-rendered-empty');
    expect(a.preview).toMatch(/Rail timetable changes/);
  });

  it.each([
    [403, 'http-403'],
    [404, 'http-4xx'],
    [410, 'http-4xx'],
    [429, 'http-429'],
    [500, 'http-5xx'],
    [401, 'login-wall'],
  ] as const)('HTTP %i is %s, even when the body looks like an article', (status, failure) => {
    const a = judge('cycle-lanes.html', { status });
    expect(a.failure).toBe(failure);
    expect(a.extract).toBeUndefined();
  });

  it('fetch problems map to their own reasons', () => {
    expect(assessFetchError('timeout')).toEqual({ evidence: 'unavailable', failure: 'timeout' });
    expect(assessFetchError('too-large').failure).toBe('too-large');
    expect(assessFetchError('network').failure).toBe('network');
  });

  it('notes when a link ended up on another page', () => {
    const html = fixture('cycle-lanes.html');
    const a = assessHtml(
      { requestedUrl: `${SITE}/redirect-cross`, finalUrl: 'http://demo.test:4173/articles/cycle-lanes.html', status: 200 },
      html,
      extractHtml(html, 'http://demo.test:4173/articles/cycle-lanes.html'),
    );
    expect(a.evidence).toBe('full');
    expect(a.finalUrl).toBe('http://demo.test:4173/articles/cycle-lanes.html');
  });
});

describe('PDFs', () => {
  const meta = { requestedUrl: `${SITE}/r.pdf`, finalUrl: `${SITE}/r.pdf`, status: 200 };
  const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? 'end.' : 'word')).join(' ');

  it('a fully read PDF with enough text is a full article', () => {
    const a = assessPdf(meta, { text: words(400), words: 400, pagesRead: 3, totalPages: 3 });
    expect(a.evidence).toBe('full');
    expect(a.extract?.method).toBe('pdf');
    expect(a.extract?.truncated).toBe(false);
  });

  it('a long PDF read only in part is a preview, and says so', () => {
    const a = assessPdf(meta, { text: words(5000), words: 5000, pagesRead: 15, totalPages: 40 });
    expect(a.evidence).toBe('partial');
    expect(a.extract?.truncated).toBe(true);
  });

  it('a PDF with no text layer (a scan) is not guessed at', () => {
    const a = assessPdf(meta, { text: '', words: 0, pagesRead: 1, totalPages: 1 });
    expect(a.failure).toBe('extraction-failed');
    expect(a.evidence).toBe('unavailable');
  });
});

describe('sentences', () => {
  it('skips bylines and fragments to find the first real sentence', () => {
    expect(firstSentence('By Jane Smith. Updated 3 hours ago. The bridge will close for six weeks in spring. More later.')).toBe(
      'The bridge will close for six weeks in spring.',
    );
  });

  it('cuts long text at a word boundary and marks the cut', () => {
    expect(limitWords('one two three four five', 3)).toBe('one two three…');
    expect(limitWords('one two three', 3)).toBe('one two three');
  });
});
