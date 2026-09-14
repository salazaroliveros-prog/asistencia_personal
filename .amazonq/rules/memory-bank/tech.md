# Technology Stack — Control Personal Campo

## Languages & Runtimes

| Layer | Language | Notes |
|-------|----------|-------|
| Frontend (runtime) | Vanilla JavaScript (ES2020+) | No framework; classic scripts + ES modules |
| Type checking | TypeScript 7.x | `src/` only, `noEmit: true`, target ES2022 |
| Backend (Cloud Functions) | Node.js / JavaScript | Firebase Cloud Functions v2 |
| Styles | CSS3 | Custom properties (variables), no preprocessor |
| Tests | JavaScript (Jest) + TypeScript (Playwright) | |

## Build System

- **Vite 8.x** — dev server and production bundler.
  - Entry: `index.html`
  - Output: `dist/`
  - Custom plugin `copyLegacyRuntime` copies `js/`, `css/`, `public/vendor/`, `public/pwa/`, and root files to `dist/` post-build.
  - UMD vendor warnings suppressed via custom logger.
  - `.ts` files are excluded from Rollup (`external: [/\.ts$/]`).
  - Sourcemaps enabled in development mode only.

## Core Dependencies

### Runtime (npm)
| Package | Version | Purpose |
|---------|---------|---------|
| `firebase` | ^12.19.0 | Firestore, Auth, Cloud Functions client |
| `@capacitor/core` | ^8.5.1 | Native bridge (Android/iOS) |
| `@capacitor/android` | ^8.5.1 | Android platform |
| `@capacitor/ios` | ^8.5.1 | iOS platform |
| `qrcode` | ^1.5.4 | QR code generation |
| `@dataconnect/generated` | file:src/dataconnect-generated | Firebase Data Connect client |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.2.2 | Build tool & dev server |
| `typescript` | ^7.0.2 | Type checking |
| `@playwright/test` | ^1.63.0 | E2E testing |
| `playwright` | ^1.63.0 | Browser automation |
| `jest` | ^29.7.0 | Unit testing |
| `jest-environment-jsdom` | ^29.7.0 | DOM environment for Jest |
| `axe-playwright` | ^2.2.2 | Accessibility testing |
| `@capacitor/cli` | ^8.5.1 | Capacitor CLI |

### Vendored Libraries (public/vendor/ — no npm)
| Library | Purpose |
|---------|---------|
| Chart.js (UMD) | Dashboard charts |
| jsPDF (UMD) + AutoTable plugin | PDF report generation |
| html2canvas | Screenshot-to-PDF |
| html5-qrcode | QR camera scanning |
| qrcode.min.js | QR code rendering |
| Lucide (UMD) | Icon set |
| Leaflet | Interactive maps |

## Firebase Services

| Service | Usage |
|---------|-------|
| Firestore | Primary database (personal, asistencias, configuracion, alertas, health) |
| Firebase Auth | User authentication with custom claims |
| Cloud Functions | `setAdminClaim` — assigns admin role to users |
| Firebase Hosting | Production deployment |
| Firebase Data Connect | Schema-based data access (experimental, `dataconnect/`) |

## Infrastructure & Deployment

- **Firebase Hosting** — primary production host (`firebase.json`)
- **Vercel** — alternative deployment (`.vercel/`, `vercel.json`)
- **Docker** — containerized deployment (`Dockerfile`, `compose.yaml`), port 3801
- **Capacitor** — native Android (`com.controlpersonalcampo.app`) and iOS packaging
  - `webDir: dist`
  - Android scheme: `https`

## Development Commands

```bash
# Start dev server (port 3801)
npm run dev

# Production build
npm run build

# Preview production build
npm start

# Type check (TypeScript, no emit)
npm run typecheck

# Run unit tests (Jest)
npm run test:unit

# Run E2E tests (Playwright, auto-starts Vite)
npm run test:e2e

# Full verification (typecheck + tests + build)
npm run verify

# Capacitor: build + sync to Android
npm run cap:android

# Capacitor: build Android APK (debug)
npm run cap:build:android

# Capacitor: open Android Studio
npm run cap:open:android
```

## Testing Configuration

### Jest (Unit Tests)
- Environment: `node`
- Test match: `__tests__/unit/**/*.test.js`
- `forceExit: true`

### Playwright (E2E)
- Test dir: `__e2e__/`
- Browser: Chromium only
- Viewport: 390×844 (iPhone 12-like), mobile emulation, touch enabled
- Timeout: 45s per test, 1 worker (sequential)
- Auto-starts Vite dev server on port 3801
- Artifacts (screenshots, video, traces) retained on failure in `__e2e__/output/`

## TypeScript Configuration

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "strict": true,
  "noEmit": true,
  "skipLibCheck": true
}
```
Only `src/**/*.ts` is type-checked; the main `js/` directory uses plain JavaScript.
