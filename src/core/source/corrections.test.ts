import { describe, expect, it } from 'vitest';
import { CORRECTIONS_PATHS, findCorrectionsPage, type PageCheck } from './corrections';

const ORIGIN = 'https://www.example.test';
const real: PageCheck = { status: 200, html: true, text: '<title>Corrections</title><h1>Corrections policy</h1>' };
const missing: PageCheck = { status: 404, html: true, text: '<h1>Not found</h1>' };

/** A fake site: a map of address -> answer. Anything not listed is "no answer at all". */
function site(answers: Record<string, PageCheck | 'fail'>) {
  const asked: string[] = [];
  const fetchPage = async (url: string) => {
    asked.push(url);
    const answer = answers[url];
    return answer === undefined || answer === 'fail' ? undefined : answer;
  };
  return { fetchPage, asked };
}

describe('the corrections page check', () => {
  it('finds a real page at the first address that has one, and says which', async () => {
    const { fetchPage, asked } = site({ [`${ORIGIN}/corrections`]: real });
    expect(await findCorrectionsPage(ORIGIN, fetchPage)).toEqual({ kind: 'found', url: `${ORIGIN}/corrections` });
    expect(asked).toEqual([`${ORIGIN}/corrections`]);
  });

  it('keeps trying the other usual addresses', async () => {
    const { fetchPage } = site({ [`${ORIGIN}/corrections`]: missing, [`${ORIGIN}/editorial-standards`]: real });
    expect(await findCorrectionsPage(ORIGIN, fetchPage)).toEqual({ kind: 'found', url: `${ORIGIN}/editorial-standards` });
  });

  it('not found at any usual address is "not-found", which is not the same as an error', async () => {
    const answers = Object.fromEntries(CORRECTIONS_PATHS.map((p) => [`${ORIGIN}${p}`, missing]));
    expect(await findCorrectionsPage(ORIGIN, site(answers).fetchPage)).toEqual({ kind: 'not-found' });
  });

  it('no answer at all from the site is an error, so the card can say it could not check', async () => {
    expect(await findCorrectionsPage(ORIGIN, site({}).fetchPage)).toEqual({ kind: 'error' });
  });

  it('a page that answers 200 but says "page not found" is not a corrections page', async () => {
    const soft: PageCheck = { status: 200, html: true, text: '<h1>Sorry, this page not found anywhere</h1>' };
    const answers = Object.fromEntries(CORRECTIONS_PATHS.map((p) => [`${ORIGIN}${p}`, soft]));
    expect(await findCorrectionsPage(ORIGIN, site(answers).fetchPage)).toEqual({ kind: 'not-found' });
  });

  it('a non-HTML answer (a file, or a redirect to a login page that was not allowed through) is not a page', async () => {
    const pdf: PageCheck = { status: 200, html: false, text: '' };
    const answers = Object.fromEntries(CORRECTIONS_PATHS.map((p) => [`${ORIGIN}${p}`, pdf]));
    expect(await findCorrectionsPage(ORIGIN, site(answers).fetchPage)).toEqual({ kind: 'not-found' });
  });

  it('asks only the short, fixed list of addresses on the site, and nowhere else', async () => {
    const { fetchPage, asked } = site({});
    await findCorrectionsPage(ORIGIN, fetchPage);
    expect(asked.length).toBe(CORRECTIONS_PATHS.length);
    for (const url of asked) expect(new URL(url).origin).toBe(ORIGIN);
  });
});
