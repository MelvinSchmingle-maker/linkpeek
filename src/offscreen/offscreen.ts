/**
 * The offscreen document: a hidden extension page with a DOM, where fetched
 * pages are parsed and read. The service worker has no DOM, and doing this in
 * the web page itself would let that page watch what LinkPeek reads.
 */
import { assessHtml, assessPdf, assessUnsupported, type Assessment } from '../core/extract/assess';
import { extractHtml } from '../core/extract/html';
import { extractPdf } from '../core/extract/pdf';
import { contentKind } from '../core/retrieve/diagnose';
import { fromBase64, type RawFetch } from '../core/retrieve/fetcher';
import { isOffscreenRequest, type OffscreenResponse } from './messages';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse: (r: OffscreenResponse) => void) => {
  if (!isOffscreenRequest(msg)) return false;
  assess(msg.raw).then(
    (assessment) => sendResponse({ ok: true, assessment }),
    (e: unknown) => sendResponse({ ok: false, error: String(e) }),
  );
  return true;
});

async function assess(raw: RawFetch): Promise<Assessment> {
  const meta = { requestedUrl: raw.requestedUrl, finalUrl: raw.finalUrl, status: raw.status };
  const kind = contentKind(raw.contentType, raw.finalUrl);
  if (kind === 'pdf' && raw.base64) {
    try {
      const pdf = await extractPdf(fromBase64(raw.base64), chrome.runtime.getURL('offscreen/pdf.worker.min.mjs'));
      return assessPdf(meta, pdf);
    } catch {
      return { evidence: 'unavailable', failure: 'extraction-failed' };
    }
  }
  if (kind === 'html' && raw.text !== undefined) {
    return assessHtml(meta, raw.text, extractHtml(raw.text, raw.finalUrl));
  }
  // An error page served as something other than HTML still counts as the error.
  if (raw.status >= 400) return assessHtml(meta, '', extractHtml('', raw.finalUrl));
  return assessUnsupported(meta);
}
