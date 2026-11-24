# Changelog

All notable changes to **CliprMax** are documented in this file.

## [0.6.0] - 2026-11-24

### Added
- **Dark Mode & Accent Colors (`src/components/Navbar.tsx`, `src/shared/theme.ts`, `src/App.tsx`)**: Added light/dark mode toggle with per-user preference, plus 6 accent color options (maroon, emerald, amber, rose, indigo, sky). Theme persists across sessions.
- **Face Tracking Visualization (`src/components/studio/ClipEditor.tsx`)**: Face detection bounding boxes with confidence labels overlay on the preview canvas when Face Tracking is enabled. Real-time face tracking updates at ~15fps.
- **Audio Waveform Visualization (`ClipEditor.tsx`)**: Low-frequency audio waveform rendered below the video preview with dynamic amplitude bars.
- **Keyboard Shortcuts** (`ClipEditor.tsx`): Space (play/pause), ←/→ (seek ±5s), M (mute), F (fullscreen) with on-screen shortcut hints.
- **Split View Toggle (`ClipEditor.tsx`)**: Added Split/Single view toggle button to the Output Preview panel for side-by-side format comparison.
- **Whisper Transcription (`server.ts`)**: New `POST /api/clips/transcribe` endpoint that extracts audio from any clip segment and transcribes it using `whisper-cli`. Returns timestamped segments with full-text.
- **React Context Theme System (`src/shared/theme.ts`)**: New `ThemeProvider`/`useTheme` hook for centralized dark mode and accent color management across the app.

### Changed
- **Video Player (`ClipEditor.tsx`)**: Replaced static image placeholder in Output Preview with a live `<video>` element supporting play/pause, seek, mute, and fullscreen. Added video error handling with inline error display and retry button.
- **ClipEditor Layout** (`ClipEditor.tsx`): Reorganized layout with top Hero section (title, description, pipeline steps), Stats row, Ingest section (link/upload forms), Projects grid, and Studio editor with Preview / Split View / Controls columns.
- **Auto Edit Button** (`ClipEditor.tsx`): Added auto-edit button that trims dead air using FFmpeg `silencedetect`.
- **Captions Selector**: Added style selector (Default / Gold / Pop / Glow) for caption styling.

### Fixed
- **Theme Provider Scope**: Fixed `useTheme` hook scope so `App.tsx` no longer duplicates theme state; `ThemeProvider` wraps entire app now.
- **Video Playback Errors**: Added `onError` handler to `<video>` element with retry capability.

### Removed
- None

---

## [0.5.0] - 2026-11-23

### Added
- **Export Quality Presets Dropdown (`ClipEditor.tsx`, `clipMath.ts`, `mediaEngine.ts`)**:
  - Replaced the fixed 2-resolution toggle with a native `#export-quality-select` dropdown supporting 5 presets end-to-end:
    - `1080p60` (`Standard 1080p60` — CRF 20, `superfast`, 60fps, 192k AAC)
    - `720p60` (`Standard 720p60` — CRF 21, `superfast`, 60fps, 160k AAC)
    - `high-quality` (`High Quality (1080p60)` — CRF 16, `faster`, 60fps, 256k AAC)
    - `streaming-optimized` (`Streaming Optimized (1080p60)` — CRF 19, 6 Mbps VBV / 12 Mbps bufsize, 2s GOP keyframes, 60fps, 192k AAC)
    - `small-file` (`Small File Size (720p30)` — CRF 27, 2.2 Mbps VBV / 4.4 Mbps bufsize, 30fps, 112k AAC)
  - Updated `Target format` readout, dynamic Export button label, `parseLocalAskCliprCommand`, `ProjectsLibrary.tsx` preset formatting (`shortLabel`), and `clipMath.test.ts` unit coverage.
- **AI Thumbnail Generator (`ClipEditor.tsx`, `server.ts`, `server/gemini.ts`, `server/mediaEngine.ts`)**:
  - Added `POST /api/clips/thumbnail` to extract 4 candidate frames across `[startSec, endSec]` in parallel via FFmpeg and select the most representative frame using Gemini Vision (`gemini-4-hydrogen` with `ThinkingLevel.LOW` and `gemini-3.1-flash-lite` fallback on transient spikes, plus FFmpeg keyframe scoring fallback).
  - Composites a framing-aware JPEG (`720×1280` vertical or `1280×720` whole-clip) with a dark scrim, Twitch-violet accent bar, and wrapped clip title overlay rendered via FFmpeg `drawtext` (`LiberationSans-Bold` / `DejaVuSans-Bold`).
  - Added `generatedThumbnail` persistence on `ClipCandidate` (keeping `clip.thumbnailUrl` clean for `Output Preview`), live preview card, method badge, timestamp/dimensions readout, and `?download=1` download link in `ClipEditor`.

### Fixed
- **Preview Stacking & Thumbnail Isolation**: Added `z-20` to the `Output Preview` split-screen divider and caption overlay in `ClipEditor.tsx` and separated `clip.generatedThumbnail` from `clip.thumbnailUrl` so switching framing modes after thumbnail generation always previews the raw source frame cleanly.

---

## [0.4.0] - 2026-11-23

### Changed
- **CliprMax Rebrand**: Updated app name and copy from `ClipMax` to **CliprMax** across `metadata.json`, `index.html`, `Navbar`, `HeroSection`, `LandingSections` (`support@cliprmax.app`), `StreamPicker`, `ClipEditor` (**Ask CliprMax** / `/api/clips/ask-cliprmax`), `server.ts` (`cliprmax_*.mp4`), `README.md`, and `CHANGELOG.md`.
- **Active Logo Switched to Razor Cut (`razor`)**: Changed the default mark in `ClipMaxLogo.tsx` (`CliprMaxLogo`) and the inline `<link rel="icon">` in `index.html` to the geometric `C` + violet-to-mint 60fps play blade (`razor`) with React `useId()` scoped SVG gradients.

### Added
- **Real-Time Export Progress Bar & ETA (`ClipEditor.tsx`)**:
  - Updated `exportClipFast` in `server/mediaEngine.ts` to spawn FFmpeg with `-progress pipe:1 -nostats` and parse live `out_time_us` and `speed`.
  - Updated `POST /api/clips/export` in `server.ts` to support `stream: true` NDJSON progress streaming (`Preparing stream segment...`, live `%`, `etaSec`, `speed`, `Finalizing MP4 metadata...`, `complete`).
  - Added pure progress & ETA helpers (`calculateRenderProgress`, `formatEtaSeconds`) in `src/utils/clipMath.ts` with unit tests in `src/utils/clipMath.test.ts` (7/7 passing).
  - Rendered an accessible `role="progressbar"` panel in `ClipEditor` showing live render stage, `tabular-nums` percentage (`%`), estimated time remaining, and encode speed.

---

## [0.3.0] - 2026-11-23

### Added
- **ClipMax Rebrand & Custom Logos**: Renamed the application from Clipr AI to **ClipMax** across `metadata.json`, `index.html` (including inline SVG favicon), UI components, **Ask ClipMax** endpoints (`/api/clips/ask-clipmax`), and exported filenames (`clipmax_*.mp4`).
- **3 Selectable Geometric Logo Concepts** (`src/components/ClipMaxLogo.tsx` and `docs/logos/`):
  - `aperture` — Vertical 9:16 aperture framed by Twitch-violet and Kick-mint crop corners (active default).
  - `razor` — Precision `C` monogram paired with a violet-to-mint 60fps play blade.
  - `stack` — Dual-layer 16:9 stream card + 9:16 vertical clip card representing Blur Fill & Split Screen framing.
- **Automatic Upload Frame Thumbnails**: Local video uploads via `/api/streams/upload` now extract a real JPEG preview frame via FFmpeg (`THUMBS_DIR` / `/api/media/thumb/:filename`) so uploaded streams preview accurately across Scan, Editor, and Projects.
- **Documentation & Screenshots**: Added `README.md`, `CHANGELOG.md`, standalone SVG logo files in `docs/logos/`, and verified screenshots in `docs/screenshots/`.

### Removed
- **Paywall & Pricing Tiers Removed**: Removed paid subscription cards (`$29.99`, `$49.99`, `$99.99`), monthly clip quota tables, and `Pricing` navigation/hero links so ClipMax runs completely free with zero watermarks.

### Verified
- Executed full end-to-end Playwright UI & button verification across Landing (`1440×900` & `390×844` mobile), all 5 StreamPicker tabs (Twitch search, Kick, YouTube + cookies toggle, local MP4 upload, 60fps Samples), Guided Scan, Quick Find, Auto Edit, Ask ClipMax, all 4 framing modes, all 4 caption styles, `720p60` & `1080p60` MP4 exports (`200 OK` downloads), and Projects Library deletion with 0 browser console errors or warnings.

---

## [0.2.0] - 2026-11-23

### Fixed
- **Node 22 Native TypeScript `npm start`**: Added explicit `.ts` extensions on relative server and utility imports (`allowImportingTsExtensions: true`) so `node server.ts` executes cleanly in production.
- **Kick Cloudflare 403 Bypass**: Added `curl` fallback in `fetchKickJson` when Node `fetch` TLS fingerprinting is rejected, restoring Kick channel and VOD lookups.
- **Fast `blur-fill` & Sample Rendering**: Downscaled the `boxblur` pass to `180×320` before scaling to output dimensions and removed software `zoompan` from sample stream generation (reducing `720p60` blur-fill export time from `5.11s` to `2.37s`).
- **Ask Clipr `"off"` Matching Bug**: Replaced substring `.includes('off')` caption matching with a targeted regex so `"trim 3s off the end"` no longer disables captions.
- **Editor & Projects UI Polish**: Added initial video poster/seek behavior in `ClipEditor.tsx`, live blurred backdrop in `blur-fill` preview, and conditional dividers on empty project cards in `ProjectsLibrary.tsx`.

---

## [0.1.0] - 2026-11-23

### Added
- Initial full-stack architecture informed by REA (`morluto/rea`) inspection and Hallmark (`nutlope/hallmark`) anti-slop UI guidelines.
- Installed official `yt-dlp` (`2026.10.26`) and integrated system `ffmpeg` / `ffprobe` (`4.4.2`) plus server-side `@google/genai` (`gemini-4-hydrogen`).
- Implemented Twitch GQL search/VODs, Kick channel/VOD lookup, YouTube resolution with `oEmbed` fallback, local upload (`multer`), 20-minute Beginning/Middle/End scan windows, Guided Scan, Quick Find, Auto Edit silence trim, `crop`/`blur-fill`/`split-screen`/`whole-clip` framing, ASS caption burn-in, fast `1080p60` & `720p60` MP4 exports, and JSON project persistence.
