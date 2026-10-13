/**
 * Every piece of branding lives here and in brand.json.
 * "LinkPeek" is a working name. To rename the product, edit brand.json:
 * the build script writes the manifest name from it, and all UI reads BRAND.
 */
import brand from './brand.json';

export const BRAND = brand;
export type BrandColors = typeof brand.colors;

export const ICONS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
} as const;
