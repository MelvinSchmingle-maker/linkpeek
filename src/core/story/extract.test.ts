/**
 * Story Search, stage 1: what LinkPeek can learn about a link from the page
 * it's on, without opening it. Scenarios 1 to 7 of the brief, plus the rules
 * that keep private details and the current page's own headline out.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { extractStoryClues } from './extract';
import { buildPackage } from './package';
import { analyseUrl, pathDate, slugWords } from './url';
import { isGenericText, redact } from './words';

function page(url: string, body: string, head = '', lang = 'en-GB'): HTMLAnchorElement {
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);
  /* eslint-disable no-restricted-properties -- test fixtures, not page data */
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  /* eslint-enable no-restricted-properties */
  document.documentElement.setAttribute('lang', lang);
  const link = document.querySelector<HTMLAnchorElement>('a[data-t]');
  if (!link) throw new Error('fixture needs a[data-t]');
  return link;
}

afterEach(() => {
  /* eslint-disable no-restricted-properties */
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  /* eslint-enable no-restricted-properties */
});

const FRONT = 'https://news.example.com/';

describe('the address (no request is made)', () => {
  it('decodes a slug into words, dropping IDs, file endings and filler segments', () => {
    expect(slugWords('/2026/11/famous-american-popstar-found-dead-hotel.html')).toBe('famous american popstar found dead hotel');
    expect(slugWords('/news/world-us-canada-67891234')).toBe('world us canada');
    expect(slugWords('/story/48213377')).toBe('');
    expect(slugWords('/entertainment/pop%20star%27s-hotel-death-investigated-a1b2c3d4')).toBe("pop star's hotel death investigated");
  });

  it('reads dates written into the path, and only plausible ones', () => {
    expect(pathDate('/2026/11/26/some-story')).toBe('2026-11-26');
    expect(pathDate('/news/2026-11-26-some-story')).toBe('2026-11-26');
    expect(pathDate('/a/20261126/story')).toBe('2026-11-26');
    expect(pathDate('/2026/11/some-story')).toBe('2026-11');
    expect(pathDate('/2026/13/40/x')).toBeUndefined();
    expect(pathDate('/products/123456789')).toBeUndefined();
  });

  it('removes tracking parameters and never sends the query string', () => {
    const f = analyseUrl('https://www.news.example.com/2026/11/story-about-the-harbour-wall?utm_source=x&token=secret#comments')!;
    expect(f.cleaned).toBe('https://www.news.example.com/2026/11/story-about-the-harbour-wall?token=secret');
    expect(f.sendable).toBe('https://www.news.example.com/2026/11/story-about-the-harbour-wall');
    expect(f.site).toBe('news.example.com');
  });

  it('unwraps link wrappers on the device', () => {
    const f = analyseUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fpaper.example.org%2F2026%2F11%2F26%2Fferry-strike-called-off&h=AT0')!;
    expect(f.unwrapped).toBe(true);
    expect(f.sendable).toBe('https://paper.example.org/2026/11/26/ferry-strike-called-off');
    expect(f.slugWords).toBe('ferry strike called off');
    // A normal Google page is not a wrapper.
    expect(analyseUrl('https://www.google.com/maps/place/x?q=https://evil.example')!.unwrapped).toBe(false);
  });

  it('flags shortened links and ignores their code (scenario 4)', () => {
    for (const href of ['https://bit.ly/3xYz9Ab', 'https://t.co/Ab12Cd34Ef', 'https://nyti.ms/4kLm2Qp', 'https://zz.co/Ab3dE9']) {
      const f = analyseUrl(href)!;
      expect(f.shortened, href).toBe(true);
      expect(f.slugWords, href).toBe('');
    }
    expect(analyseUrl('https://news.example.com/2026/11/ferry-strike-called-off')!.shortened).toBe(false);
  });

  it('knows generic link text when it sees it', () => {
    for (const t of ['Read more', 'Read the full story »', 'Click here', 'Continue reading…', '→', 'See more']) expect(isGenericText(t), t).toBe(true);
    expect(isGenericText('Ferry strike called off')).toBe(false);
  });
});

describe('extraction from the page', () => {
  it('1. a link with a full descriptive headline uses it, with high confidence', () => {
    const link = page(FRONT, '<main><h2><a data-t href="/2026/11/26/famous-american-popstar-found-dead-in-hotel">Famous American popstar found dead in hotel</a></h2></main>');
    const c = extractStoryClues(link)!;
    expect(c.headline).toEqual({ text: 'Famous American popstar found dead in hotel', from: 'link-text', confidence: 'high' });
    expect(c.date).toEqual({ text: '2026-11-26', from: 'url-date', confidence: 'medium' });
    expect(c.slug?.text).toBe('famous american popstar found dead in hotel');
    expect(c.url).toBe('https://news.example.com/2026/11/26/famous-american-popstar-found-dead-in-hotel');
    expect(c.language).toBe('en-GB');
  });

  it('2. "Read more" finds the real headline and teaser in its article card', () => {
    const link = page(
      FRONT,
      `<main><section><h2>Latest</h2>
        <article class="story-card">
          <span class="kicker">Entertainment</span>
          <h3>Police investigate death of music superstar at city hotel</h3>
          <p class="summary">Officers were called to the Grand Meridian hotel early on Tuesday after staff raised the alarm.</p>
          <time datetime="2026-11-24T08:10:00Z">24 November</time>
          <a data-t href="/p/889123">Read more</a>
        </article>
        <article class="story-card"><h3>Something else entirely</h3><a href="/p/1">Read more</a></article>
      </section></main>`,
    );
    const c = extractStoryClues(link)!;
    expect(c.linkText?.confidence).toBe('low');
    expect(c.headline).toEqual({ text: 'Police investigate death of music superstar at city hotel', from: 'card-heading', confidence: 'high' });
    expect(c.description).toMatchObject({ from: 'card-teaser', text: expect.stringContaining('Grand Meridian hotel') });
    expect(c.date).toEqual({ text: '2026-11-24', from: 'card-label', confidence: 'high' });
    expect(c.section?.text).toBe('Entertainment');
    // The neighbouring card is not mixed in.
    expect(JSON.stringify(c)).not.toContain('Something else entirely');
    const pkg = buildPackage(c);
    expect(pkg.ok && pkg.request.headline?.text).toBe('Police investigate death of music superstar at city hotel');
    // "Read more" is never sent as a headline.
    expect(JSON.stringify(pkg)).not.toContain('Read more');
  });

  it('3. a link with only a useful slug still gives a search', () => {
    const link = page(FRONT, '<main><div><a data-t href="https://paper.example.org/2026/11/famous-american-popstar-found-dead-hotel">Link</a></div></main>');
    const c = extractStoryClues(link)!;
    expect(c.headline).toBeUndefined();
    expect(c.slug?.text).toBe('famous american popstar found dead hotel');
    const pkg = buildPackage(c);
    expect(pkg.ok).toBe(true);
    if (pkg.ok) {
      expect(pkg.request.slug).toBe('famous american popstar found dead hotel');
      expect(pkg.request.date).toBe('2026-11');
    }
  });

  it('4. a shortened link relies on its text, and says it is shortened', () => {
    const link = page('https://social.example/feed', '<main><article><p>Huge news tonight <a data-t href="https://bit.ly/3xYz9Ab">bit.ly/3xYz9Ab</a> pop star found dead in hotel room, police say</p></article></main>');
    const c = extractStoryClues(link)!;
    expect(c.shortened).toBe(true);
    expect(c.slug).toBeUndefined();
    expect(c.context?.text).toContain('pop star found dead in hotel room');
    const pkg = buildPackage(c);
    expect(pkg.ok && pkg.request.shortened).toBe(true);
  });

  it('5. a link in running text sends the sentence around it, not the whole page', () => {
    const filler = '<p>' + 'Unrelated paragraph about gardening and tomatoes. '.repeat(30) + '</p>';
    const link = page(
      'https://blog.example.net/posts/weekly-roundup',
      `<main><article>${filler}<p>The council finally confirmed the ferry timetable. As <a data-t href="https://paper.example.org/a/123">this report</a> explains, the winter service will drop to four crossings a day. Campaigners say that is not enough.</p>${filler}</article></main>`,
    );
    const c = extractStoryClues(link)!;
    expect(c.context?.text).toContain('the winter service will drop to four crossings a day');
    expect(c.context!.text.length).toBeLessThanOrEqual(601);
    expect(c.context!.text).not.toContain('tomatoes');
  });

  it('6. structured data describing the linked story is used, and the page’s own headline is not', () => {
    const head = `<title>Front page | Example News</title>
      <meta property="og:title" content="Example News: the day's top stories">
      <meta property="og:site_name" content="Example News">
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, item: { '@type': 'NewsArticle', url: 'https://news.example.com/world/hotel-death', headline: 'Pop star Jamie Rivers found dead at Paris hotel', description: 'French police have opened an inquiry.', datePublished: '2026-11-25T06:00:00Z', articleSection: 'World', author: { name: 'A. Reporter' }, keywords: ['Jamie Rivers', 'Paris'] } },
          { '@type': 'ListItem', position: 2, item: { '@type': 'NewsArticle', url: 'https://news.example.com/other', headline: 'Another story' } },
        ],
      })}</script>`;
    const link = page(FRONT, '<main><div class="tile"><a data-t href="https://news.example.com/world/hotel-death?utm_source=home"><img alt="" src="x.jpg"></a></div></main>', head);
    const c = extractStoryClues(link)!;
    expect(c.headline).toEqual({ text: 'Pop star Jamie Rivers found dead at Paris hotel', from: 'linked-metadata', confidence: 'high' });
    expect(c.description?.text).toBe('French police have opened an inquiry.');
    expect(c.date).toEqual({ text: '2026-11-25', from: 'linked-metadata', confidence: 'high' });
    expect(c.author?.text).toBe('A. Reporter');
    expect(c.section?.text).toBe('World');
    expect(c.keywords).toEqual(['Jamie Rivers', 'Paris']);
    expect(c.publisher?.text).toBe('Example News');
    expect(JSON.stringify(c)).not.toContain("the day's top stories");
    expect(c.pageRelation).toBe('unrelated');
  });

  it('6b. a link to the page itself uses the page’s own metadata', () => {
    const head = `<link rel="canonical" href="https://news.example.com/world/hotel-death">
      <meta property="og:title" content="Pop star Jamie Rivers found dead at Paris hotel">
      <meta property="og:description" content="French police have opened an inquiry.">
      <meta property="article:published_time" content="2026-11-25T06:00:00Z">`;
    const link = page('https://news.example.com/world/hotel-death', '<main><a data-t href="https://news.example.com/world/hotel-death#comments">Share</a></main>', head);
    const c = extractStoryClues(link)!;
    expect(c.pageRelation).toBe('same-page');
    expect(c.headline).toMatchObject({ text: 'Pop star Jamie Rivers found dead at Paris hotel', from: 'page-metadata', confidence: 'high' });
    expect(c.date?.text).toBe('2026-11-25');
  });

  it('7. a link with almost nothing to go on sends nothing', () => {
    const link = page(FRONT, '<main><div><a data-t href="https://example.com/p/12345">Read more</a></div></main>');
    expect(buildPackage(extractStoryClues(link))).toEqual({ ok: false, reason: 'insufficient' });
  });

  it('7b. a bare "Read more" after other stories does not borrow their headline', () => {
    const link = page(FRONT, '<main><article class="story-card"><h3><a href="/a">Bridge closure planned for repairs</a></h3></article><div><a data-t href="https://example.com/p/12345">Read more</a></div></main>');
    expect(buildPackage(extractStoryClues(link))).toEqual({ ok: false, reason: 'insufficient' });
  });

  it('7c. a heading right above a link, in the same block, is used', () => {
    const link = page(FRONT, '<main><section><div><h3>Bridge closure planned for repairs next month</h3><p>Details to follow.</p><a data-t href="/p/77">Continue reading</a></div></section></main>');
    expect(extractStoryClues(link)!.headline?.text).toBe('Bridge closure planned for repairs next month');
  });

  it('a page form whose inputs shadow DOM methods ("matches", "closest") cannot break extraction', () => {
    const link = page(FRONT, '<main><form class="story-card"><input name="matches"><input name="closest"><h3>Ferry strike called off after late-night talks</h3><a data-t href="/p/5">Read more</a></form></main>');
    expect(extractStoryClues(link)!.headline?.text).toBe('Ferry strike called off after late-night talks');
  });

  it('a non-web link is not investigated', () => {
    const link = page(FRONT, '<main><a data-t href="mailto:someone@example.com">Email the newsroom about the hotel story</a></main>');
    expect(buildPackage(extractStoryClues(link))).toEqual({ ok: false, reason: 'not-a-web-link' });
  });
});

describe('privacy', () => {
  it('never reads form fields, editable areas or hidden text', () => {
    const link = page(
      FRONT,
      `<main><article class="card"><h3>Ferry strike called off after late-night talks</h3>
        <input value="my-password-123"><textarea>private draft about my divorce</textarea>
        <div contenteditable="true">secret note</div><span hidden>hidden tracking text</span>
        <a data-t href="/p/1">Read more</a></article></main>`,
    );
    const all = JSON.stringify(buildPackage(extractStoryClues(link)));
    for (const s of ['my-password-123', 'private draft', 'secret note', 'hidden tracking text']) expect(all).not.toContain(s);
  });

  it('removes email addresses and phone numbers from text near the link', () => {
    expect(redact('Contact jo.bloggs@mail.example.com or +44 20 7946 0958 about the 2026-11-26 story')).toBe(
      'Contact [email] or [number] about the 2026-11-26 story',
    );
    const link = page('https://forum.example/thread/1', '<main><p>Posted by jo@mail.example.com: see <a data-t href="https://paper.example.org/2026/11/26/ferry-strike-called-off">this</a> about the ferry strike being called off.</p></main>');
    expect(JSON.stringify(buildPackage(extractStoryClues(link)))).not.toContain('jo@mail.example.com');
  });

  it('never sends the current page’s address', () => {
    const link = page('https://mail.example.com/inbox/message/abc123?token=secret', '<main><p><a data-t href="https://paper.example.org/2026/11/26/ferry-strike-called-off">Ferry strike called off after late-night talks</a></p></main>');
    const pkg = JSON.stringify(buildPackage(extractStoryClues(link)));
    expect(pkg).not.toContain('mail.example.com');
    expect(pkg).not.toContain('secret');
  });

  it('a page title like an inbox is not used when it has nothing in common with the link', () => {
    const link = page('https://mail.example.com/', '<main><a data-t href="https://paper.example.org/a/9">Read more</a></main>', '<title>Inbox (3) - jo@mail.example.com</title><meta property="og:title" content="Inbox (3)">');
    expect(JSON.stringify(extractStoryClues(link))).not.toContain('Inbox');
  });
});
