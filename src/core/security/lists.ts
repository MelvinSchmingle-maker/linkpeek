/**
 * The short lists the link checks use. Each one is a guess at what's common,
 * and each is tested (eval/urls.json). Edit a list, then run the tests.
 */

/**
 * Brands that scammers copy. `label` is the name part of the brand's own
 * domains ("paypal" for paypal.com). `extra` lists other domains the brand
 * owns whose name part is different. Only the name part is compared, so a
 * brand on another country's domain (paypal.de) is still that brand.
 */
export interface Brand {
  name: string;
  label: string;
  extra?: string[];
}

export const BRANDS: Brand[] = [
  { name: 'PayPal', label: 'paypal', extra: ['paypalobjects.com'] },
  { name: 'Apple', label: 'apple', extra: ['icloud.com', 'me.com'] },
  { name: 'Google', label: 'google', extra: ['gmail.com', 'youtube.com', 'googleapis.com'] },
  { name: 'Microsoft', label: 'microsoft', extra: ['live.com', 'outlook.com', 'hotmail.com', 'office.com', 'microsoftonline.com'] },
  { name: 'Amazon', label: 'amazon', extra: ['amazonaws.com', 'ssl-images-amazon.com'] },
  { name: 'Netflix', label: 'netflix' },
  { name: 'eBay', label: 'ebay' },
  { name: 'Facebook', label: 'facebook', extra: ['fb.com', 'meta.com'] },
  { name: 'Instagram', label: 'instagram' },
  { name: 'WhatsApp', label: 'whatsapp' },
  { name: 'LinkedIn', label: 'linkedin' },
  { name: 'Dropbox', label: 'dropbox' },
  { name: 'HSBC', label: 'hsbc' },
  { name: 'Barclays', label: 'barclays' },
  { name: 'Lloyds', label: 'lloyds' },
  { name: 'NatWest', label: 'natwest' },
  { name: 'Santander', label: 'santander' },
  { name: 'Halifax', label: 'halifax' },
  { name: 'Monzo', label: 'monzo' },
  { name: 'Revolut', label: 'revolut' },
  { name: 'Nationwide', label: 'nationwide' },
  { name: 'Coinbase', label: 'coinbase' },
  { name: 'Binance', label: 'binance' },
  { name: 'Steam', label: 'steampowered', extra: ['steamcommunity.com'] },
];

/** Words in a web address or link text that come with a sign-in, verification or payment page. */
export const SECURITY_WORDS = ['secure', 'security', 'verify', 'verification', 'login', 'log-in', 'signin', 'sign-in', 'account', 'update', 'billing', 'support', 'help', 'confirm', 'unlock', 'suspended'];

/** Words in a path that a sign-in or payment page usually has. */
export const SIGN_IN_PATH = /(^|\/)(login|log-in|signin|sign-in|verify|verification|secure|payment|checkout|billing|confirm|account)(\/|$|\?|\.|-)/i;

/** Link shorteners: the real destination is hidden until the link is followed. */
export const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'is.gd',
  'rebrand.ly',
  'cutt.ly',
  'tiny.cc',
  'shorturl.at',
  'lnkd.in',
  'fb.me',
  'rb.gy',
  'v.gd',
]);

/** Files that install or run something, or pack many files together. */
export const RISKY_FILE = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|jar|apk|dmg|pkg|iso|zip|rar|7z|tar\.gz)$/i;

/** Scripts in which a single word is normally written with one alphabet. Mixing them in one label is how lookalikes are made. */
export const SCRIPT_RANGES: [string, RegExp][] = [
  ['Latin', /\p{Script=Latin}/u],
  ['Cyrillic', /\p{Script=Cyrillic}/u],
  ['Greek', /\p{Script=Greek}/u],
  ['Armenian', /\p{Script=Armenian}/u],
  ['Cherokee', /\p{Script=Cherokee}/u],
];

/**
 * The digit and letter swaps a lookalike typically uses. Applied to a whole
 * name, so "paypa1" and "arnazon" (rn for m) match their brands.
 */
export function skeleton(name: string): string {
  return name
    .toLowerCase()
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');
}
