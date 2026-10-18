/**
 * LinkPeek's own small window for asking access to a link's site. Chrome
 * only shows its permission prompt after a click on an extension page, so
 * the card in the web page opens this window instead of asking directly.
 */
import type { WorkerMessage } from '../content/messages';
import { ALL_SITES } from '../core/sites';
import { applyBrand } from '../ui/theme';

applyBrand();
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab'));
let target: URL | undefined;
try {
  target = new URL(params.get('url') ?? '');
  if (target.protocol !== 'https:' && target.protocol !== 'http:') target = undefined;
} catch {
  target = undefined;
}

// An X card also needs X's shortener (t.co) for the first hop. The window asks for it in the same prompt.
const SHORTENER = 'https://t.co/';
const alsoParam = params.get('also');
const alsoOrigin = alsoParam === SHORTENER ? 't.co' : undefined;

const status = $('#status');
if (!target) {
  $('#host').textContent = 'this site';
  status.textContent = "This isn't a web address LinkPeek can read.";
  $<HTMLButtonElement>('#allow-site').disabled = true;
  $<HTMLButtonElement>('#allow-all').disabled = true;
} else {
  $('#host').textContent = target.hostname;
  $('#allow-site').textContent = `Allow ${target.hostname}`;
  if (alsoOrigin) $('#also').hidden = false;
}

function request(origins: string[]): void {
  if (alsoOrigin) origins = [...origins, `https://${alsoOrigin}/*`];
  // Called straight from the click, so Chrome shows its prompt.
  chrome.permissions.request({ origins }).then(
    (granted) => {
      if (!granted) {
        status.textContent = 'Not allowed. You can close this window.';
        return;
      }
      status.textContent = 'Allowed. Reading the link…';
      const msg: WorkerMessage = { type: 'permission-granted', tabId };
      void chrome.runtime.sendMessage(msg).finally(() => window.close());
    },
    () => {
      status.textContent = "Chrome didn't accept the request.";
    },
  );
}

$('#allow-site').addEventListener('click', () => {
  if (target) request([`${target.protocol}//${target.hostname}/*`]);
});
$('#allow-all').addEventListener('click', () => request(ALL_SITES));
$('#cancel').addEventListener('click', () => window.close());
