# Pixel Leap v2.0 Implementation Plan

> **Status: implemented (2026-10-20).** All eight tasks shipped; 48 `node:test` cases pass, bundle is 78.1 KB (≤80 KB gate), and the browser flow was verified with headless Edge at 320 / 390 / 480 / 1280 px. See `CHANGELOG.md` and `README.md` for the delivered scope and verification evidence.

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v2.0 P0 scope of 像素跳跳乐 / Pixel Leap — a zero-install, single-file Canvas jumper with fair physics, a share loop, WCAG 2.2 AA core UI, and a performance budget.

**Architecture:** Modular ES modules in `src/` (pure simulation separated from renderer/DOM), concatenated by a zero-dependency `build.mjs` into one self-contained `index.html` (no external runtime requests). Node-only test suite exercises the pure simulation headlessly, including the 300 s robot climb required by PRD 8.6.

**Tech Stack:** Vanilla JS (ES2022), Canvas 2D, WebAudio, DOM overlays, Node `node:test`, Python+Pillow (static OG asset only).

**Spec:** `C:\Users\13323\Documents\deepseek-harness\default-workspace\prd\像素跳跳乐_PRD_v2.0.md`

## Global Constraints

- Logical resolution 480 × 720, integer-scaled; physics fixed at 1/60 s, max 5 catch-up steps.
- Gravity 2300 px/s²; jump 950 px/s (≈196 px); spring 1520 px/s; max horizontal 345 px/s.
- Vertical gap 66–116 px; horizontal offset ±135 px; platform width 78–104 px shrinking to ≥52 px; camera threshold 44%; death at bottom +110 px.
- Score = floor((startY − minY) / 8) + stars × 10; best score and mute persist in `localStorage`.
- Landing only from above, swept collision (no tunnelling at 1500 px/s), 9 px edge tolerance.
- First platform fixed directly above; first star on the jump path; no special platforms in the first 420 px.
- Single delivered `index.html`, ≤80 KB raw, 0 third-party requests, no external fonts.
- Plan B privacy: zero analytics network requests; local-only ledger.
- Copy is fixed by PRD 9.5 / 10.2 (Chinese default, English P1).

## Review Focus

- Resize / 200 % zoom / 320 px width: stage must stay fully visible, no horizontal scroll, ≥44 px targets.
- Tab order and focus visibility across menu → pause → over → share, plus `aria-live` announcements at state changes only.
- Corrupted `localStorage`, unavailable audio, and denied clipboard: the game keeps running with human-readable feedback.
- Pointer capture: drag off-canvas must not stick, page must not scroll or select text.
- Moving/crumbling platform edge cases: no pass-through, no teleport when the platform moves under a falling player.

---

### Task 1: Project skeleton + build pipeline

**Files:** `package.json`, `build.mjs`, `src/main.js` (placeholder), `styles.css`, `tests/build.test.mjs`

**Interfaces:**
- Produces: `node build.mjs` → `index.html`; build manifest order array.

- [ ] Build script inlines `styles.css` and every `src/**/*.js` in dependency order inside one IIFE, strips ES `import`/`export` keywords.
- [ ] `tests/build.test.mjs` asserts output exists, is ≤80 KB, and contains no `http://` / `https://` runtime resource reference other than declared metadata.
- [ ] Run: `node --test tests/` → PASS.

### Task 2: Simulation core (physics, generation, scoring)

**Files:** `src/core/config.js`, `src/core/rng.js`, `src/core/world.js`, `src/core/score.js`, `tests/physics.test.mjs`, `tests/generation.test.mjs`, `tests/score.test.mjs`, `tests/robot.test.mjs`

**Interfaces (produced):**
- `createWorld({ seed })` → world
- `world.reset(seed?)`, `world.step()`, `world.press(dir)`, `world.release(dir)`
- `world.snapshot()` → `{ score, meters, stars, best, cameraY, zone }`
- `world.events` — `[{ type, ... }]` per step (`land`, `spring`, `crack`, `star`, `zone`, `dead`)
- `stepWorld(world)` advances exactly 1/60 s.
- `heightMeters(px)`, `computeScore(heightPx, stars)`.

- [ ] Tests pin: peak jump height 190–202 px; 1500 px/s fall cannot tunnel a 12 px platform; 9 px edge tolerance lands, 20 px misses; side/underside pass-through.
- [ ] Generation tests: gap ≤116, |dx| ≤135, width ≥52, first platform centred above player, no specials in first 420 px, same seed ⇒ identical layout, 7000 px normalization caps at 1.
- [ ] Robot test: 300 simulated seconds, auto-aim nearest reachable platform, assert height strictly grows past 3000 px, no `unreachable` platforms, no stuck frames.
- [ ] Run: `node --test tests/` → PASS.

### Task 3: Rendering (pixel art, zones, particles, juice)

**Files:** `src/render/palette.js`, `src/render/background.js`, `src/render/sprites.js`, `src/render/renderer.js`

**Interfaces:**
- `createRenderer(canvas)` → `{ draw(state, alpha, now), resize(), flash(type) }`
- `drawBackground(ctx, camY, zoneMix, t)`, `drawPlayer(ctx, p)`, `drawPlatform(ctx, plat, t)`.

- [ ] 480×720 backbuffer, `image-rendering: pixelated`, DPR-aware CSS sizing via integer scale.
- [ ] Three zones (night 0 m / dusk 200 m / deep space 500 m) with palette cross-fade; parallax stars, clouds, nebula, moon/sun.
- [ ] Platform semantics per PRD 9.2 (colour + shape + motion); spring compression, crack animation, star twinkle.
- [ ] Particles: land dust, star burst, crack debris, +10 float; screen shake ≤6 px, disabled under reduced motion.
- [ ] Edge-TS screenshot check at 390×844 and 1280×800.

### Task 4: DOM shell, HUD, state machine, a11y

**Files:** `src/ui/i18n.js`, `src/ui/ui.js`, `src/ui/a11y.js`, `src/main.js`, `styles.css`

- [ ] States: Menu / Playing / Paused / Over / Error; overlays are real buttons (Tab order), focus trap-free, focus visible.
- [ ] HUD: score, metres, star pill, pause/mute ≥44 px, top scrim; DOM writes only on value change.
- [ ] `aria-live="polite"` announcements exactly per PRD 10.2; never per-frame.
- [ ] Input: ←/→/A/D, Space/Enter start, P/Esc pause, pointer capture, touch buttons, `touch-action: none`.
- [ ] Pause on `visibilitychange`; resume without catch-up frames.
- [ ] Reduced motion: no shake, half particles, instant zone transitions; audio unaffected.

### Task 5: Audio, storage, error handling

**Files:** `src/platform/audio.js`, `src/platform/storage.js`, `src/platform/errors.js`

- [ ] WebAudio initialised on first gesture; jump/land/star/spring/crack/fall/best/UI cues + subtle zone arpeggio; mute persists.
- [ ] `storage.js` tolerant parse: corrupted best → reset 0, one-time toast, `storage_error`; private mode failure does not block play.
- [ ] Fatal canvas-context loss → pause, retry once, then menu + refresh hint.

### Task 6: Share loop + local ledger

**Files:** `src/platform/share.js`, `src/platform/ledger.js`, `src/ui/sharecard.js`

- [ ] Share button only on new record; text per PRD 6.4; link `?ref=share`, no PII.
- [ ] Web Share (with generated 1200×630 PNG when `canShare({files})`) → text share → clipboard; every outcome toasts within 800 ms.
- [ ] `share_open` / `share_outcome` recorded locally only.
- [ ] Ledger: run count, best trend, max zone, sessions; `?debug=1` export panel; zero network.

### Task 7: Static assets — OG image, SEO, privacy, PWA

**Files:** `assets/og-image.png` (generated), `privacy.html`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `sw.js`, `README.md`

- [ ] PIL-generated 1200×630 pixel-art share card ≤150 KB.
- [ ] `<title>`, description, canonical, OG/Twitter, JSON-LD `VideoGame`, `lang="zh-CN"`, theme-color.
- [ ] `privacy.html` states Plan B: no network, local-only storage, how to clear.
- [ ] Manifest + cache-first SW registered only on http(s); update prompt non-blocking.

### Task 8: Verification gate

- [ ] `node --test tests/` all green; robot climb logs max height.
- [ ] Build size ≤80 KB; grep proves 0 runtime third-party URLs.
- [ ] Edge headless screenshots at 320×568 / 390×844 / 1280×800: no clipping, HUD readable, pixel art intact.
- [ ] Manual keyboard-only path menu → play → pause → resume → die → retry; console clean.
- [ ] README, changelog, privacy copy cross-checked against the event dictionary.
