# Part 01. Project setup

## Goal
An empty but real LinkPeek extension that loads in Chrome, plus a working build, test and lint setup. No features yet.

## Before you start
Look at the current folder. If it's empty, scaffold here. If it's an existing LinkPeek project, audit it and reuse what works. If it's an unrelated project, don't touch its files: create a separate `linkpeek/` folder.

Write a short audit (what exists, what works, what's missing, what can be reused, what looks hard) in `docs/audit.md`.

## Build
- Manifest V3 with only these to start: `storage`, `activeTab`, `scripting`. No host permissions yet.
- Vite + TypeScript build that outputs a loadable `dist/` folder.
- Folder layout with empty, documented modules:
  `src/content/` (page detection and UI), `src/background/` (service worker), `src/core/detect/`, `src/core/retrieve/`, `src/core/extract/`, `src/core/summary/`, `src/core/clickbait/`, `src/core/source/`, `src/core/security/`, `src/core/feedback/`, `src/core/storage/`, `src/popup/`, `src/options/`, `src/adapters/`.
- `src/brand.ts` with name, colours and icon paths.
- Shared types in `src/core/types.ts`, including `EvidenceLevel = 'full' | 'partial' | 'headline-only' | 'unavailable'` and a `LinkResult` shape.
- Placeholder icons (simple, clearly temporary).
- A popup that just says "LinkPeek is installed" and shows the version.
- Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`.
- One Playwright test that loads the unpacked extension in Chromium and checks the popup opens.
- Docs: `README.md` (install the unpacked extension step by step), `docs/decisions.md`, `docs/privacy.md` (starts as "nothing leaves the device"), `docs/permissions.md` (each permission and why, in plain English), `docs/references.md`.

## Don't
- Don't build any feature UI yet.
- Don't request `<all_urls>` or broad host permissions.

## Done when
- `build`, `typecheck`, `lint` and `test` all pass.
- The Playwright test loads the extension and passes.
- Following the README, a beginner can load the extension in Chrome.

## Your check
Follow the README yourself and load the extension in Chrome (chrome://extensions, Developer mode, Load unpacked, pick `dist`). Click the toolbar icon. If you see "LinkPeek is installed", Part 01 is done.
