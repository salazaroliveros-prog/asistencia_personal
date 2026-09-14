# Project Structure — Control Personal Campo

## Directory Layout

```
control_asistencia_app/
├── index.html                  # Main SPA entry point
├── field-scanner.html          # Standalone QR scanner for field use
├── field-scanner.js            # Scanner logic (independent from main app)
├── service-worker.js           # PWA service worker (offline caching)
├── manifest.json               # PWA manifest (main app)
├── field-scanner-manifest.json # PWA manifest (scanner)
├── favicon.svg / field-scanner-favicon.svg
│
├── js/                         # Core application JavaScript
│   ├── config.js               # Global constants, AppState store, DEFAULT_CONFIG
│   ├── firebase-config.js      # Firebase credentials + validation (classic script)
│   ├── firebase-client.js      # Firestore/Auth SDK initialization & API wrapper
│   ├── api.js                  # Data access layer (local ↔ Firestore abstraction)
│   ├── app.js                  # SPA router, module loader, event orchestration
│   │
│   ├── modules/                # Feature modules (one per app section)
│   │   ├── personal.js         # Worker CRUD, QR cards, history modal
│   │   ├── asistencia.js       # Attendance marking, autocomplete, GPS check
│   │   ├── dashboard.js        # Daily summary, shift status, charts
│   │   ├── reportes.js         # Report generation and preview
│   │   ├── ajustes.js          # Settings form, Firebase config, GPS config
│   │   ├── campo.js            # Field-specific attendance view
│   │   ├── backup-manager.js   # Data backup/restore
│   │   ├── gas-assistant.js    # AI assistant integration
│   │   └── user-management.js  # User roles and auth management
│   │
│   └── utils/                  # Shared utility modules
│       ├── alerts.js           # Toast/alert notifications
│       ├── bulk-operations.js  # Batch Firestore operations
│       ├── cache-manager.js    # LocalStorage cache abstraction
│       ├── constants.js        # Shared constants
│       ├── dashboard-enhancer.js # Chart.js dashboard widgets
│       ├── data-export.js      # CSV/Excel export helpers
│       ├── data-validator.js   # Input validation logic
│       ├── date-helpers.js     # Date formatting, timezone utilities
│       ├── error-handler.js    # Global error handling
│       ├── gps.js              # Geolocation API wrapper
│       ├── keyboard-shortcuts.js # Keyboard navigation
│       ├── logger.js           # Structured logging
│       ├── map-viewer.js       # Leaflet map integration
│       ├── pdf-builder.js      # jsPDF report generation
│       ├── performance-optimizer.js # Debounce, lazy loading
│       ├── photo-helpers.js    # Image capture/resize utilities
│       ├── qr-generator.js     # QR code generation (qrcode.js)
│       ├── realtime-validation.js # Live form validation
│       ├── request-optimizer.js   # Firestore query batching
│       ├── string-helpers.js   # Text normalization, DPI formatting
│       ├── theme-manager.js    # Dark/light theme
│       ├── update-manager.js   # PWA update prompts
│       ├── validation-rules.js # Validation rule definitions
│       └── validators.js       # Validator functions
│
├── css/                        # Stylesheets
│   ├── main.css                # Global styles, CSS variables, layout
│   ├── components.css          # Reusable UI components
│   ├── glassmorphism.css       # Glass-effect card styles
│   ├── campo.css               # Field scanner specific styles
│   ├── accessibility.css       # A11y overrides
│   └── print.css               # Print/PDF styles
│
├── public/
│   ├── pwa/icons/              # PWA icon set (72–512px, maskable variants)
│   ├── pwa/scanner.*           # Scanner PWA assets
│   └── vendor/                 # Vendored third-party libraries (no npm bundling)
│       ├── chart.umd.min.js    # Chart.js
│       ├── jspdf.umd.min.js    # jsPDF
│       ├── jspdf.plugin.autotable.min.js
│       ├── html2canvas.min.js
│       ├── html5-qrcode.min.js
│       ├── qrcode.min.js
│       ├── lucide.min.js       # Icon library
│       └── leaflet/            # Map library
│
├── functions/
│   ├── index.js                # Firebase Cloud Functions (setAdminClaim, etc.)
│   └── package.json
│
├── src/
│   ├── domain/
│   │   ├── types.ts            # TypeScript domain types
│   │   └── attendance.ts       # Attendance domain logic
│   ├── api.ts                  # TypeScript API surface
│   └── dataconnect-generated/  # Firebase Data Connect generated client
│
├── __tests__/                  # Test suite
│   ├── unit/                   # Jest unit tests
│   └── *.js                    # Integration/validation scripts
│
├── __e2e__/                    # Playwright end-to-end tests
│   └── mobile-ui.spec.ts
│
├── android/                    # Capacitor Android project
├── ios/                        # Capacitor iOS generated files
├── dataconnect/                # Firebase Data Connect schema & connectors
├── docs/                       # Project documentation (Spanish)
└── .amazonq/rules/memory-bank/ # Amazon Q memory bank
```

## Core Architectural Patterns

### SPA with Classic Scripts (No Framework)
- `index.html` loads scripts in order: `config.js` → `firebase-config.js` → `firebase-client.js` → `api.js` → `app.js` → modules.
- No React/Vue/Angular. DOM manipulation is direct via `document.getElementById` / `innerHTML`.
- Navigation is hash-based (`#personal`, `#asistencia`, `#dashboard`, etc.) handled by `app.js`.

### Reactive Global State (AppState)
- `AppState` in `config.js` is a hand-rolled observable store (IIFE pattern).
- Modules subscribe via `AppState.on(key, callback)` and update via `AppState.set(key, value)`.
- State is persisted to `localStorage` using `LS_KEYS` constants.

### Dual Backend Mode
- `backendMode: 'local'` — data lives only in `localStorage`.
- `backendMode: 'firestore'` — data syncs to Firebase Firestore; local cache is kept as fallback.
- `api.js` abstracts this so modules never call Firestore directly.

### Module Pattern
- Each feature module exports an `init()` function called by `app.js` on navigation.
- Modules communicate through `AppState` and DOM events, not direct imports.

### Vendor Libraries (No Bundler for Runtime)
- Third-party libs are vendored in `public/vendor/` and loaded via `<script>` tags.
- Vite is used only for build optimization; the app also runs without a build step.

### Security Model
- Firebase Auth with custom claims (`admin: true`) enforced in both Firestore Rules and Cloud Functions.
- A single authorized operator email is hardcoded in Firestore Rules for attendance creation.
- Client-side validation mirrors server-side Firestore Rules validation.
