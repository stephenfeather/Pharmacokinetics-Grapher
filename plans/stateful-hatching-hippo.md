# Desktop Application Packaging Plan

## Context

The Pharmacokinetics Grapher is currently a Vue 3 web application with a clean, lightweight frontend (336KB total, 111KB gzipped). The user needs to distribute this as a downloadable desktop application for non-technical end users who require:

- **Full offline functionality** (no internet required after installation)
- **No hosting infrastructure** (users download and install locally)
- **Simple installation** (double-click installer, no technical setup)

The app is a perfect candidate for desktop packaging because:
- Pure static frontend (no backend/API dependencies)
- Uses localStorage for data persistence (works in desktop context)
- Small bundle size (enables quick downloads)
- Self-contained functionality (all calculations client-side)

## Recommended Approach: Tauri v2

**Framework Choice: Tauri v2** (over Electron)

### Why Tauri?

| Criterion | Tauri | Electron | Winner |
|-----------|-------|----------|---------|
| Bundle Size | 3-5 MB | 50-100 MB | **Tauri** (15-30x smaller) |
| Memory Usage | 40-60 MB | 150+ MB | **Tauri** (3x less) |
| Vite Integration | Native, zero config | Requires plugins | **Tauri** |
| Browser Engine | OS-native WebView | Bundles Chromium | **Tauri** (no duplication) |
| Security | Restrictive by default | Permissive | **Tauri** |
| Setup | Rust toolchain needed | Node only | Electron (simpler) |

**Decision:** Tauri's dramatically smaller bundles (3-5 MB vs 50-100 MB) and first-class Vite support make it the clear winner for this lightweight frontend app.

### Trade-offs
- **Pro:** Tiny installers, low memory, native performance, built for Vite
- **Con:** Requires Rust toolchain for development (one-time setup)
- **Acceptable:** For a 336KB app, bundling 50MB+ of Chromium is wasteful

---

## Implementation Plan

### Phase 1: Initialize Tauri Project

**Install Prerequisites:**
```bash
# 1. Install Rust toolchain (one-time)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install Tauri CLI
npm install --save-dev @tauri-apps/cli

# 3. Initialize Tauri
npm run tauri init
```

**Configuration during `tauri init`:**
- App name: `Pharmacokinetics Grapher`
- Window title: `Pharmacokinetics Grapher`
- Dev server URL: `http://localhost:5173`
- Frontend dist dir: `../dist`
- Dev command: `npm run dev`
- Build command: `npm run build`

**Result:** Creates `/src-tauri/` directory with Rust files and configuration.

---

### Phase 2: Configure Application

#### 1. Update `package.json`

**Add scripts:**
```json
{
  "version": "1.0.0",
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:mac": "tauri build --target universal-apple-darwin",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  }
}
```

**Add devDependency:**
```json
{
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

#### 2. Update `vite.config.ts`

**Add Tauri compatibility settings:**
```typescript
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // Tauri-specific settings
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
```

#### 3. Configure `src-tauri/tauri.conf.json`

**Key settings to configure:**

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Pharmacokinetics Grapher",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false
    },
    "bundle": {
      "active": true,
      "targets": ["dmg", "msi", "deb", "appimage"],
      "identifier": "com.pkgrapher.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "windows": [
      {
        "title": "Pharmacokinetics Grapher",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ]
  }
}
```

**Window sizing rationale:**
- Default 1200x800: Comfortable for viewing graphs + form
- Minimum 800x600: Prevents UI breaking at small sizes
- Resizable: Users can maximize for larger graphs

#### 4. Update `index.html`

**Fix title:**
```html
<title>Pharmacokinetics Grapher</title>
```

(Currently says "Vite App" at line 7)

---

### Phase 3: Create App Icon

**Generate platform-specific icons:**

```bash
# 1. Create or obtain a 512x512 PNG icon
# (Graph/chart symbol with medical theme)

# 2. Generate all platform formats
npm run tauri icon path/to/icon-512.png
```

**Outputs created in `src-tauri/icons/`:**
- `32x32.png`, `128x128.png`, `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `icon.png` (Linux, 512x512)

**Icon design suggestions:**
- Graph/chart line with medical cross
- Pill/capsule silhouette with ascending curve
- Simple, recognizable at small sizes

---

### Phase 4: Build & Test

#### Development Testing

```bash
# Run desktop app in dev mode
npm run tauri:dev
```

**Verify:**
- [x] App window opens at 1200x800
- [x] PrescriptionForm accepts input
- [x] Graph renders correctly
- [x] localStorage persists (close app, reopen, data remains)
- [x] No console errors (right-click → Inspect to see DevTools)

#### Production Build

```bash
# Build for current platform
npm run tauri:build

# Platform-specific builds
npm run tauri:build:mac      # macOS universal binary
npm run tauri:build:windows  # Windows x64
npm run tauri:build:linux    # Linux x64
```

**Output locations:**
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg` (~3-5 MB)
- Windows: `src-tauri/target/release/bundle/msi/*.msi` (~3-4 MB)
- Linux: `src-tauri/target/release/bundle/deb/*.deb` (~3-4 MB)
- Linux: `src-tauri/target/release/bundle/appimage/*.AppImage` (~5-8 MB)

---

### Phase 5: Offline Verification

**Critical test to ensure full offline capability:**

1. Build production app: `npm run tauri:build`
2. Install the built app
3. **Disconnect internet** (airplane mode)
4. Launch app
5. Verify:
   - [x] App opens successfully
   - [x] Can create new prescription
   - [x] Graph renders
   - [x] Data saves to localStorage
   - [x] Zero network requests (check DevTools Network tab)

**Expected behavior:** All assets bundled, no CDN dependencies, Chart.js loaded locally.

---

### Phase 6: Distribution Setup

**Recommended: GitHub Releases**

```bash
# 1. Create version tag
git tag v1.0.0
git push --tags

# 2. Create GitHub Release from tag
# (via GitHub web UI or gh CLI)
gh release create v1.0.0 --title "v1.0.0 - Initial Desktop Release"

# 3. Upload installers as release assets
gh release upload v1.0.0 \
  src-tauri/target/release/bundle/dmg/*.dmg \
  src-tauri/target/release/bundle/msi/*.msi \
  src-tauri/target/release/bundle/deb/*.deb \
  src-tauri/target/release/bundle/appimage/*.AppImage
```

**Benefits of GitHub Releases:**
- Free hosting for all installers
- Version management built-in
- CDN distribution (fast global downloads)
- Download analytics
- Foundation for auto-updates (future enhancement)

---

## Critical Files

### Files to Modify

1. **`/package.json`**
   - Bump version: `"version": "1.0.0"`
   - Add `@tauri-apps/cli` to devDependencies
   - Add `tauri:dev`, `tauri:build`, platform-specific build scripts

2. **`/vite.config.ts`**
   - Add `clearScreen: false`
   - Add `server: { port: 5173, strictPort: true }`
   - Add `envPrefix: ['VITE_', 'TAURI_']`

3. **`/index.html`**
   - Change title from "Vite App" to "Pharmacokinetics Grapher"

### New Files Created by `tauri init`

4. **`/src-tauri/tauri.conf.json`**
   - Configure window settings (1200x800 default, 800x600 min)
   - Set bundle targets (dmg, msi, deb, appimage)
   - Configure app metadata and permissions

5. **`/src-tauri/Cargo.toml`**
   - Rust dependencies (Tauri version, features)
   - Auto-generated, minimal changes needed

6. **`/src-tauri/src/main.rs`**
   - Rust entry point (default implementation works)
   - Optional: Add menu bar customization later

7. **`/src-tauri/build.rs`**
   - Build script (auto-generated, no changes needed)

8. **`/src-tauri/icons/`** (after running `tauri icon`)
   - Platform-specific icon files (icns, ico, png)

### Optional Documentation Files

9. **`/README-DESKTOP.md`** (create manually)
   - Installation instructions per platform
   - Platform-specific quirks (Gatekeeper on macOS, SmartScreen on Windows)
   - Building from source guide

---

## Platform-Specific Considerations

### macOS

**Installer:** `.dmg` with drag-to-Applications
**Expected Warning:** "Cannot verify developer" (Gatekeeper)
**User Workaround:** Right-click → Open (one-time bypass)
**Future:** Code signing requires Apple Developer account ($99/year)

### Windows

**Installer:** `.msi` (Windows Installer)
**Expected Warning:** SmartScreen "Unknown publisher"
**User Workaround:** "More info" → "Run anyway"
**Future:** Code signing cert ($50-300/year) eliminates warning

### Linux

**Installers:**
- `.deb` for Debian/Ubuntu (install via `sudo dpkg -i`)
- `.AppImage` for universal Linux (portable, no install required)

**Dependency:** WebKitGTK (usually pre-installed)
**If missing:** `sudo apt install libwebkit2gtk-4.1-0`

---

## Verification Checklist

### Pre-Build Verification
- [ ] Install Rust toolchain successfully
- [ ] `npm run tauri:dev` opens app window
- [ ] Dev mode shows app at 1200x800
- [ ] Can inspect with DevTools (right-click → Inspect)
- [ ] All Vue features work in Tauri window

### Build Verification
- [ ] `npm run tauri:build` completes without errors
- [ ] Installer file exists in `src-tauri/target/release/bundle/`
- [ ] Bundle size is 3-6 MB (not 50+ MB)
- [ ] Double-clicking installer works

### Offline Verification (CRITICAL)
- [ ] Install production build
- [ ] Disconnect internet completely
- [ ] Launch app successfully
- [ ] Create prescription (enter data, view graph)
- [ ] Close and reopen app (data persists via localStorage)
- [ ] DevTools Network tab shows **zero requests**

### Cross-Platform Testing
- [ ] macOS: DMG opens, drag to Applications works, app launches from /Applications
- [ ] Windows: MSI installs, Start Menu shortcut created, app launches
- [ ] Linux: .deb installs via dpkg OR AppImage runs directly

### Distribution Verification
- [ ] Git tag created: `v1.0.0`
- [ ] GitHub Release published
- [ ] All platform installers uploaded
- [ ] Download links work
- [ ] Installation instructions clear per platform

---

## Expected Outcomes

### Bundle Sizes
- **macOS DMG:** 3-5 MB (universal binary, Intel + Apple Silicon)
- **Windows MSI:** 3-4 MB (x64)
- **Linux .deb:** 3-4 MB (x64)
- **Linux AppImage:** 5-8 MB (includes bundled dependencies)

**Comparison to Electron:** 15-30x smaller (Electron would be 50-100 MB)

### User Experience
- Download installer (3-5 MB, ~5 seconds on typical broadband)
- Double-click to install (no technical steps)
- App launches in native window
- Works fully offline (no internet required after install)
- Data persists in app-specific localStorage
- Window is resizable, starts centered at 1200x800

### Maintenance
- **Version bumps:** Update 3 files (package.json, Cargo.toml, tauri.conf.json)
- **Rebuilds:** `npm run tauri:build` (takes 2-5 minutes)
- **Dependencies:** Update Tauri CLI via npm, Rust deps via `cargo update`

---

## Future Enhancements (Post-MVP)

1. **Auto-updater:** Tauri built-in updater (checks GitHub Releases)
2. **Code signing:** Eliminate OS warnings (requires certs/accounts)
3. **App stores:** Publish to Mac App Store, Microsoft Store, Snap Store
4. **Menu bar:** Custom File/Edit/Help menus with About dialog
5. **Export/Import:** Save prescriptions to JSON files (Tauri filesystem API)
6. **CI/CD:** GitHub Actions to auto-build on tag push

---

## Implementation Timeline Estimate

**Note:** Time estimates removed per project guidelines. Implementation phases listed in logical order:

### Phase Sequence
1. **Setup** - Install Rust, initialize Tauri, configure files
2. **Development Testing** - Run `tauri:dev`, verify functionality
3. **Icon Creation** - Design/generate platform icons
4. **Production Build** - Build for all platforms
5. **Offline Testing** - Verify full offline capability
6. **Distribution** - Create GitHub Release, upload installers
7. **Documentation** - Write installation guide per platform

Work proceeds sequentially through phases; each phase completion enables the next.

---

## Success Criteria

The implementation is complete when:

1. ✅ Running `npm run tauri:build` produces installers for all platforms
2. ✅ Bundle sizes are 3-6 MB (confirms Tauri, not Electron)
3. ✅ Offline test passes (app works with internet disconnected)
4. ✅ Installation works on each platform (macOS, Windows, Linux)
5. ✅ localStorage persists data across app restarts
6. ✅ GitHub Release contains all installers with download instructions
7. ✅ Non-technical user can download, install, and use without help

---

## Rollback Plan

If Tauri integration encounters blocking issues:

1. **Fallback to PWA:** Convert to Progressive Web App (still works offline, installable from browser)
2. **Fallback to Electron:** If Tauri has platform-specific WebView bugs (rare)
3. **Stay Web-Only:** Host on Netlify/Vercel, document offline PWA install

**Risk Assessment:** Low - Tauri v2 is stable, Vite integration is first-class, app has no complex dependencies
