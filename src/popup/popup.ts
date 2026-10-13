import { BRAND } from '../brand';
import { applyBrandColors } from '../ui/theme';

applyBrandColors(document.documentElement);
document.title = BRAND.name;
for (const el of document.querySelectorAll('[data-brand-name]')) el.textContent = BRAND.name;
const version = document.querySelector('[data-version]');
if (version) version.textContent = chrome.runtime.getManifest().version;
