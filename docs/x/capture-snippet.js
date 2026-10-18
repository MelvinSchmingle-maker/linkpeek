(() => {
  // LinkPeek: X link capture. Paste this whole block into the DevTools console (F12 > Console) on an
  // X page that has one post with a link in it. It prints the STRUCTURE of the links on the page:
  // hosts, attribute names and short text. It does not print full addresses, paths, query strings,
  // account names or long text. Read the output before you share it.
  const hostOf = (value) => {
    try {
      return new URL(value, location.href).host;
    } catch {
      return '';
    }
  };
  // Visible text, shortened: handles masked, and any path after a domain masked (the host stays).
  const shortText = (s) =>
    (s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/@[\w.]+/g, '@name')
      .replace(/([\w-]+(?:\.[\w-]+)+)\/\S*/g, '$1/…')
      .slice(0, 40);
  const attributeNames = (el) => Array.from(el.attributes).map((a) => a.name);
  // Attributes that might hold a destination, with the host only. The value is never printed.
  const urlAttributes = (el) =>
    Array.from(el.attributes)
      .filter((a) => a.name !== 'href' && /url|expand|title|dest|target/i.test(a.name))
      .map((a) => ({ name: a.name, host: /^https?:\/\//i.test(a.value) ? hostOf(a.value) : '(not a web address)' }));
  const ancestors = (el, depth) => {
    const out = [];
    let node = el.parentElement;
    for (let i = 0; i < depth && node; i++, node = node.parentElement) out.push(node);
    return out;
  };
  const testIds = (el) =>
    ancestors(el, 8)
      .map((n) => n.getAttribute('data-testid'))
      .filter(Boolean);

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const links = anchors.map((a) => {
    const href = a.getAttribute('href') || '';
    const host = /^https?:\/\//i.test(href) ? hostOf(href) : href ? '(relative link)' : '';
    return {
      host,
      isTco: host === 't.co',
      text: shortText(a.textContent),
      textLooksLikeDomain: /^[\w-]+(\.[\w-]+)+/.test((a.textContent || '').trim()),
      anchorAttributes: attributeNames(a),
      anchorUrlAttributes: urlAttributes(a),
      ancestorUrlAttributes: ancestors(a, 4).flatMap((n) => urlAttributes(n).map((u) => ({ ...u, on: n.tagName.toLowerCase() }))),
      testIdsAbove: testIds(a),
      insideArticle: Boolean(a.closest('article')),
    };
  });
  const tco = links.filter((l) => l.isTco);
  const result = {
    page: { host: location.host, path: location.pathname.split('/').filter(Boolean).map((p, i) => (i === 0 ? p : '…')).join('/') },
    linkCount: links.length,
    tcoCount: tco.length,
    // Attribute names that appear on every t.co link, and on some: the first place to look for an expanded address.
    tcoAttributeNames: [...new Set(tco.flatMap((l) => l.anchorAttributes))].sort(),
    tcoUrlAttributes: tco.flatMap((l) => l.anchorUrlAttributes.concat(l.ancestorUrlAttributes)),
    links,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
})();
