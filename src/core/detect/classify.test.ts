import { describe, expect, it } from 'vitest';
import { classifyLink } from './classify';
import { readLinkFeatures } from './features';

const PAGE = 'https://news.example.com/';

/**
 * Labelled examples. Each snippet has one target link marked data-t.
 * true = should get the LinkPeek icon, false = should not.
 */
const CASES: [string, string, boolean][] = [
  // ---- Should get an icon ----
  ['headline in h2', '<main><h2><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes">Council approves new cycle lanes for High Street</a></h2></main>', true],
  ['headline in article h3', '<article><h3><a data-t href="https://news.example.com/news/uk-politics-68412345">Minister resigns after row over housing targets</a></h3></article>', true],
  ['heading wrapped by link', '<main><a data-t href="https://news.example.com/world/flooding-hits-coastal-towns-after-storm"><h3>Flooding hits coastal towns after storm</h3></a></main>', true],
  ['article header headline', '<article><header><h2><a data-t href="https://blog.example.org/posts/how-we-cut-our-build-times-in-half">How we cut our build times in half</a></h2></header></article>', true],
  ['external report pdf', '<main><p><a data-t href="https://gov.example.org/files/annual-report-2025.pdf">Read the full annual report on regional transport</a></p></main>', true],
  ['date path, plain paragraph', '<main><p><a data-t href="https://paper.example.com/2026/09/rail-fares-rise-again-in-january">Rail fares will rise again in January, operators confirm</a></p></main>', true],
  ['long slug in list', '<main><ul><li><a data-t href="https://news.example.com/science/new-study-links-sleep-and-memory-in-older-adults">New study links sleep and memory in older adults</a></li></ul></main>', true],
  ['reddit post', '<main><h3><a data-t href="https://www.reddit.com/r/UKPersonalFinance/comments/1abcde/is_it_worth_overpaying_my_mortgage/">Is it worth overpaying my mortgage?</a></h3></main>', true],
  ['youtube watch', '<main><h3><a data-t href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">The history of the London Underground in 20 minutes</a></h3></main>', true],
  ['substack post', '<article><h2><a data-t href="https://writer.substack.com/p/why-small-towns-are-losing-their-banks">Why small towns are losing their banks</a></h2></article>', true],
  ['x status in heading', '<article><h3><a data-t href="https://x.com/someone/status/1845678901234567890">Thread on what the new budget means for renters</a></h3></article>', true],
  ['research publication', '<main><h3><a data-t href="https://institute.example.ac.uk/publications/child-poverty-trends-2026">Child poverty trends 2026</a></h3></main>', true],
  ['numeric story id', '<main><h4><a data-t href="https://local.example.co.uk/story/48213377">Hospital car park charges to be scrapped</a></h4></main>', true],
  ['opinion piece', '<main><h3><a data-t href="https://paper.example.com/opinion/2026/oct/10/four-day-week-is-not-a-fantasy">The four-day week is not a fantasy</a></h3></main>', true],
  ['article link with query id', '<main><h3><a data-t href="https://forum.example.net/viewtopic.php?id=992817">Best way to insulate a solid wall house?</a></h3></main>', true],
  ['card headline without main', '<div class="card"><h3><a data-t href="https://news.example.com/business/energy-bills-to-fall-in-april">Energy bills to fall in April, regulator says</a></h3></div>', true],
  ['press release', '<main><h2><a data-t href="https://company.example.com/press-releases/q3-results-2026">Third quarter results 2026</a></h2></main>', true],
  ['guide page', '<main><h3><a data-t href="https://advice.example.org/guides/how-to-appeal-a-parking-fine">How to appeal a parking fine</a></h3></main>', true],
  ['category in path but real article', '<main><h3><a data-t href="https://news.example.com/category/politics/2026/10/vote-on-planning-bill-delayed">Vote on planning bill delayed again</a></h3></main>', true],
  ['same-site article in list item heading', '<main><li><h3><a data-t href="/2026/10/school-meals-pilot-extended">School meals pilot extended to more areas</a></h3></li></main>', true],

  // ---- Should NOT get an icon ----
  ['nav link', '<nav><a data-t href="https://news.example.com/world">World</a></nav>', false],
  ['nav link with long text', '<nav><a data-t href="https://news.example.com/2026/10/some-long-headline-in-a-mega-menu">A long headline inside a mega menu</a></nav>', false],
  ['page header logo text', '<header><a data-t href="https://news.example.com/">The Example News</a></header>', false],
  ['footer privacy', '<footer><a data-t href="https://news.example.com/privacy">Privacy policy</a></footer>', false],
  ['login', '<main><a data-t href="https://news.example.com/login">Log in</a></main>', false],
  ['subscribe button-ish', '<main><a data-t href="https://news.example.com/subscribe?ref=top">Subscribe for just £1 a week to keep reading</a></main>', false],
  ['read more', '<article><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes">Read more</a></article>', false],
  ['read more with arrow', '<article><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes">Continue reading →</a></article>', false],
  ['mailto', '<main><a data-t href="mailto:editor@example.com">Email the editor about this story</a></main>', false],
  ['tel', '<main><a data-t href="tel:+441234567890">Call our newsroom tip line</a></main>', false],
  ['javascript', '<main><a data-t href="javascript:void(0)">Show the rest of the comments</a></main>', false],
  ['same-page anchor', '<main><a data-t href="https://news.example.com/#comments">Jump to the comment section below</a></main>', false],
  ['image only', '<main><a data-t href="https://news.example.com/2026/10/photo-story-of-the-week"><img src="x.jpg" alt=""></a></main>', false],
  ['twitter share', '<article><a data-t href="https://twitter.com/intent/tweet?url=https://news.example.com/a">Share this story on X</a></article>', false],
  ['facebook sharer', '<article><a data-t href="https://www.facebook.com/sharer/sharer.php?u=https://news.example.com/a">Share this story on Facebook</a></article>', false],
  ['social profile', '<main><p><a data-t href="https://x.com/examplenews">Follow The Example News on X</a></p></main>', false],
  ['instagram profile', '<main><p><a data-t href="https://www.instagram.com/examplenews/">See our photos on Instagram today</a></p></main>', false],
  ['tag page', '<article><a data-t href="https://news.example.com/tag/climate-change">Climate change</a></article>', false],
  ['author page', '<article><a data-t href="https://news.example.com/authors/jane-smith">Jane Smith</a></article>', false],
  ['topic page with long text', '<main><h3><a data-t href="https://news.example.com/topics/cost-of-living">Everything on the cost of living crisis</a></h3></main>', false],
  ['homepage link in body', '<main><p><a data-t href="https://other.example.org/">Visit the Other Example Organisation website</a></p></main>', false],
  ['sponsored link', '<main><h3><a data-t rel="sponsored" href="https://shop.example.com/deals/autumn-sale-on-sofas-and-beds">Autumn sale on sofas and beds</a></h3></main>', false],
  ['taboola widget', '<main><a data-t href="https://trc.taboola.com/example/log/3/click?pi=x">Doctors stunned by this one simple trick</a></main>', false],
  ['outbrain widget', '<main><a data-t href="https://paid.outbrain.com/network/redir?p=abc">You will not believe these celebrity homes</a></main>', false],
  ['role button', '<main><a data-t role="button" href="https://news.example.com/2026/10/live-blog-updates">Load latest updates to this live blog</a></main>', false],
  ['menu toggle', '<main><a data-t aria-haspopup="true" href="https://news.example.com/sections/all-sections-of-the-site">All sections of the site</a></main>', false],
  ['breadcrumb', '<ol aria-label="Breadcrumb"><li><a data-t href="https://news.example.com/news/uk/politics-and-government-section">Politics and government section</a></li></ol>', false],
  ['zip download', '<main><a data-t href="https://data.example.org/files/flood-map-data-2026.zip">Download the full flood map data set</a></main>', false],
  ['image file', '<main><a data-t href="https://cdn.example.com/photos/storm-damage-high-res.jpg">See the storm damage photo in high resolution</a></main>', false],
  ['comments count', '<article><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes#comments">245 comments</a></article>', false],
  ['pagination', '<main><a data-t href="https://news.example.com/page/2">Next</a></main>', false],
  ['account', '<main><a data-t href="https://news.example.com/account/settings">Manage your account and saved articles</a></main>', false],
  ['reddit user profile', '<main><a data-t href="https://www.reddit.com/u/somebody">u/somebody</a></main>', false],
  ['short section link in body', '<main><p><a data-t href="https://news.example.com/sport">Sport</a></p></main>', false],
  ['in-text link to a reference article', '<main><p>Cycling took off quickly in Victorian Britain; see <a data-t href="https://en.wikipedia.org/wiki/History_of_the_bicycle_in_the_United_Kingdom">History of the bicycle in the United Kingdom</a> for the full background and the clubs that formed.</p></main>', false],
  ['in-text link with short anchor', '<main><p>Figures <a data-t href="https://stats.example.gov/releases/housing-q3">published on Tuesday</a> show a rise.</p></main>', false],
  ['github commit message', '<main><table><tr><td><a data-t href="https://github.com/owner/repo/commit/3f9a1c2b7d4e5f60718293a4b5c6d7e8f9012345">Fix typo in README installation section</a></td></tr></table></main>', false],
  ['github commit title in h4', '<main><h4><a data-t href="https://github.com/owner/repo/commit/a1b2c3d4e5f60718293a4b5c6d7e8f901234abcd">Refactor the parser to stream large inputs</a></h4></main>', false],
  ['google docs id', '<main><div><a data-t href="https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit">Q3 planning notes for the marketing team</a></div></main>', false],
  ['amazon product title', '<main><h2><a data-t href="https://www.amazon.co.uk/Anker-Charger-Foldable-Compatible-MacBook/dp/B0B2MLJ3R8/ref=sr_1_1">Anker USB C charger, 65W foldable, compatible with MacBook</a></h2></main>', false],
  ['ebay item', '<main><h3><a data-t href="https://www.ebay.co.uk/itm/1234567890123">Vintage brass desk lamp in working order</a></h3></main>', false],
  ['wikipedia category link', '<main id="content"><div id="catlinks"><ul><li><a data-t href="https://en.wikipedia.org/wiki/Category:Transport_in_the_London_Borough_of_Camden">Transport in the London Borough of Camden</a></li></ul></div></main>', false],
  ['continue reading with screen-reader title', '<main><article><a data-t class="more-link" href="https://blog.example.org/2026/10/our-ci-move/">Continue reading<span class="screen-reader-text"> Moving our CI to self-hosted runners</span></a></article></main>', false],
  ['leave a comment on title', '<main><article><footer class="entry-footer"><a data-t href="https://blog.example.org/2026/10/our-ci-move/#respond">Leave a comment<span class="screen-reader-text"> on Moving our CI to self-hosted runners</span></a></footer></article></main>', false],
  ['comment count inside main article', '<main><article><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes#comments">245 comments</a></article></main>', false],
  ['read full story', '<main><article><a data-t href="https://news.example.com/2026/10/12/council-approves-new-cycle-lanes">Read full story</a></article></main>', false],
  ['sidebar recent comment link', '<main><aside role="complementary"><ul><li><a data-t href="https://blog.example.org/2026/09/30/moving-our-ci-to-self-hosted-runners/#comment-42">Moving our CI to self-hosted runners</a></li></ul></aside></main>', false],
  ['sidebar docs menu', '<aside><ul><li><a data-t href="https://docs.example.org/guide/getting-started-with-the-command-line">Getting started with the command line tools</a></li></ul></aside>', false],
  ['bluesky profile', '<main><p>Follow <a data-t href="https://bsky.app/profile/someone.bsky.social">our reporter on Bluesky for live updates</a> today.</p></main>', false],
  ['account settings deep path', '<main><a data-t href="https://news.example.com/account/settings/privacy">Manage your account privacy and data settings</a></main>', false],
  ['rss feed', '<main><a data-t href="https://news.example.com/feeds/latest.rss">Subscribe to our latest headlines feed</a></main>', false],
];

function classifySnippet(html: string) {
  const host = document.createElement('div');
  host.innerHTML = html; // eslint-disable-line no-restricted-properties -- test fixture, not page data
  document.body.append(host);
  const link = host.querySelector<HTMLAnchorElement>('a[data-t]')!;
  const features = { ...readLinkFeatures(link), pageUrl: PAGE };
  // Resolve relative hrefs against the test page URL, not the test runner's.
  features.href = new URL(link.getAttribute('href')!, PAGE).href;
  host.remove();
  return classifyLink(features);
}

function score() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const [, html, expected] of CASES) {
    const got = classifySnippet(html).isCandidate;
    if (got && expected) tp++;
    else if (got) fp++;
    else if (expected) fn++;
  }
  return { precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn) };
}
const SCORES = score();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

describe('link classifier', () => {
  for (const [name, html, expected] of CASES) {
    it(`${expected ? 'icon' : 'no icon'}: ${name}`, () => {
      const result = classifySnippet(html);
      expect(result.isCandidate, `score ${result.score}: ${result.reasons.join(', ')}`).toBe(expected);
    });
  }

  it('has at least 40 labelled examples', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });

  // Precision matters most: an icon on a menu link annoys more than a
  // missing icon, which the user can fix with right-click > Peek.
  // The measured figures are in the test's name, so they show in the output.
  it(`precision ${pct(SCORES.precision)} and recall ${pct(SCORES.recall)} on ${CASES.length} labelled links (precision must be 95%+)`, () => {
    expect(SCORES.precision).toBeGreaterThanOrEqual(0.95);
  });
});
