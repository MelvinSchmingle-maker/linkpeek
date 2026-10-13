import { BRAND } from '../brand';
import { applyBrandColors } from '../ui/theme';

applyBrandColors(document.documentElement);
document.title = `${BRAND.name} settings`;
for (const el of document.querySelectorAll('[data-brand-name]')) el.textContent = BRAND.name;
