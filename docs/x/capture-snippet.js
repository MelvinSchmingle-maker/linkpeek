/* global $0 */
(() => {
  // LinkPeek: X post capture. Paste into the DevTools console.
  //
  // Before running: on the X post, right-click the external link and choose Inspect. The link is then
  // selected in the Elements panel, and this script reads it as $0. Nothing else on the page is read.
  //
  // It prints ONLY structure: the link's hostname, attribute NAMES, the tag names and test IDs from the
  // link up to its post, and the HOSTNAME of any web address held in an attribute of that link or its post.
  // It never prints: visible text, the page path, account names, post IDs, query strings, full addresses,
  // or raw attribute values. It doesn't look outside the one post, and it makes no network request.
  const POST = 'article, [data-testid="tweet"]';
  const X_HOSTS = ['x.com', 'twitter.com'];
  const isXHost = (host) => X_HOSTS.some((x) => host === x || host.endsWith(`.${x}`));
  // The hostname of a web address held in an attribute, or null. Never the path, query, or user name.
  const hostnameOf = (value) => {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return null;
    try {
      const url = new URL(value.trim());
      if (url.username || url.password) return null;
      return url.hostname || null;
    } catch {
      return null;
    }
  };
  const report = (status, details) => {
    const result = { status, ...details };
    console.log(JSON.stringify(result, null, 2));
    return result;
  };

  if (typeof $0 === 'undefined' || !$0 || $0.nodeType !== 1) {
    return report('not-found', { reason: 'Right-click the external link in the post, choose Inspect, then run this again.' });
  }
  const post = $0.closest(POST);
  if (!post) {
    return report('not-found', { reason: 'The selected element is not inside a post container.' });
  }
  const isExternal = (a) => {
    const host = hostnameOf(a.getAttribute('href'));
    return Boolean(host) && !isXHost(host);
  };

  // The link: the selected one, or the single external link in this post. Never guessed.
  let anchor = $0.closest('a[href]');
  if (!anchor || !post.contains(anchor)) {
    const external = Array.from(post.querySelectorAll('a[href]')).filter(isExternal);
    if (external.length !== 1) {
      return report('ambiguous', {
        reason: 'Select the link itself in the Elements panel, not the text around it.',
        externalLinksInPost: external.length,
      });
    }
    anchor = external[0];
  }

  // Elements from the link up to its post (inclusive). Only these are read.
  const chain = [];
  for (let node = anchor.parentElement; node; node = node.parentElement) {
    chain.push(node);
    if (node === post) break;
  }
  const tagOf = (el) => el.tagName.toLowerCase();
  const testIdOf = (el) => el.getAttribute('data-testid');

  // Destinations: web addresses in attributes of the link and its post. Hostnames only.
  const candidateDestinations = [];
  for (const el of [anchor, ...chain]) {
    for (const attr of Array.from(el.attributes)) {
      if (el === anchor && attr.name === 'href') continue; // the link itself is reported below
      const host = hostnameOf(attr.value);
      if (host) candidateDestinations.push({ attribute: attr.name, on: tagOf(el), hostname: host, isXHost: isXHost(host) });
    }
  }

  const linksInPost = Array.from(post.querySelectorAll('a[href]'));
  return report('ok', {
    pageHostname: location.hostname,
    anchor: {
      hostname: hostnameOf(anchor.getAttribute('href')) ?? 'not a web address',
      isTco: hostnameOf(anchor.getAttribute('href')) === 't.co',
      attributeNames: Array.from(anchor.attributes, (a) => a.name),
      ancestors: [...chain].map((el) => ({ tag: tagOf(el), testId: testIdOf(el) })),
    },
    candidateDestinations,
    post: {
      tag: tagOf(post),
      testId: testIdOf(post),
      linkCount: linksInPost.length,
      externalLinkCount: linksInPost.filter(isExternal).length,
    },
  });
})();
