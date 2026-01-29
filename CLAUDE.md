# CLAUDE.md - AI Assistant Guidelines for my-website

## Project Overview

This is a **Windows 95 Nostalgia Personal Portfolio Website** for André Smit (GitHub: iiSmitty). The site is hosted on GitHub Pages at **andresmit.co.za** and features an authentic Windows 95 aesthetic while showcasing personal projects, running achievements, music preferences, and coffee loyalty stats.

## Tech Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+) - no frameworks or bundlers
- **Hosting**: GitHub Pages (static site)
- **CI/CD**: GitHub Actions for automated data updates
- **External APIs**: Strava, Spotify, Seattle Coffee Company (scraped)

## Project Structure

```
/home/user/my-website/
├── .github/
│   ├── scripts/           # Node.js automation scripts
│   │   ├── fetch-strava-data.js    # Strava API integration
│   │   ├── coffee-scraper.js       # Puppeteer-based scraping
│   │   ├── spotify-data-fetcher.js # Spotify API integration
│   │   └── get_token.js            # OAuth token helper
│   └── workflows/         # GitHub Actions
│       ├── update-strava-data.yml   # Daily @ 6 AM UTC
│       ├── update-coffee-stats.yml  # Daily @ 8 AM UTC
│       ├── spotify-data-update.yml  # Weekly on Mondays
│       └── uptime-monitor.yml       # Every 15 minutes
├── css/
│   ├── styles.css         # Main Win95 theme (~1900 lines)
│   └── clippy.css         # Clippy assistant styling
├── data/                  # Dynamic JSON data (auto-updated by workflows)
│   ├── strava-pbs.json    # Running personal bests
│   ├── spotify-data.json  # Top artists/tracks
│   └── coffee-stats.json  # Loyalty program stats
├── icons/                 # Icon assets (.ico, .png, .svg)
├── images/                # Image assets
├── js/                    # Frontend JavaScript modules
│   ├── win95-components.js   # Menu bar, keyboard nav, dropdowns
│   ├── program-icons.js      # Desktop icons, window dragging
│   ├── decrypt.js            # Decryption easter egg
│   ├── strava-pbs.js         # Running stats display
│   ├── coffee-simple.js      # Coffee stats display
│   ├── clippy.js             # iOS Clippy easter egg
│   ├── screensaver.js        # Flying Windows screensaver
│   ├── floppy-disk.js        # Floppy disk interaction
│   ├── mobile-detection.js   # Device detection
│   ├── tech-counter.js       # Tech skills counter
│   ├── watermark.js          # Watermark logic
│   └── utils.js              # Utility functions
├── sounds/                # Audio assets (Win95 sounds)
├── index.html             # Main homepage
├── strava-pbs.html        # Strava personal bests page
├── 404.html               # Custom error page
├── CNAME                  # GitHub Pages custom domain
└── sitemap.xml            # SEO sitemap
```

## Development Guidelines

### No Build System
This is a **static site with no build process**. Changes to HTML, CSS, or JS files are immediately reflected when pushed to GitHub Pages. There is no npm/yarn for the main codebase - dependencies are only used in GitHub Actions scripts.

### Code Conventions

**JavaScript:**
- Modular approach: one file per feature/concern
- Use `addEventListener` for event handling
- Direct DOM manipulation (no framework)
- Async/await for data fetching
- Error handling with try-catch and graceful fallbacks
- Session storage for navigation state

**CSS:**
- BEM-like naming: `.win95-container`, `.win95-button`, `.win95-menu-bar`
- Windows 95 authentic color palette (grays, teal, blues)
- Responsive design with mobile breakpoints
- 3D beveled button effects using borders

**HTML:**
- Semantic structure
- Inline script references at end of body
- Windows 95 UI patterns (title bars, menus, dialogs)

### Data Files

The `/data/` directory contains JSON files that are **automatically updated by GitHub Actions**:

| File | Updated By | Schedule |
|------|-----------|----------|
| `strava-pbs.json` | update-strava-data.yml | Daily 6 AM UTC |
| `spotify-data.json` | spotify-data-update.yml | Weekly (Mondays) |
| `coffee-stats.json` | update-coffee-stats.yml | Daily 8 AM UTC |

**Do not manually edit these files** unless fixing a data issue - they will be overwritten by automated workflows.

### GitHub Actions Workflows

1. **update-strava-data.yml** - Fetches running data from Strava API
2. **update-coffee-stats.yml** - Scrapes Seattle Coffee Company loyalty stats
3. **spotify-data-update.yml** - Fetches top artists/tracks from Spotify
4. **uptime-monitor.yml** - Monitors site availability, creates issues on failures

Workflows use Node.js 16-18 and install dependencies at runtime (axios, puppeteer).

## Key Features & Easter Eggs

1. **Clippy Assistant** (`js/clippy.js`) - iOS-only Easter egg with snarky Apple comments
2. **Decryption Animation** (`js/decrypt.js`) - Reveals contact info with hacker-movie effect
3. **Windows 95 Dialogs** (`js/decrypt.js`) - Startup/shutdown experience
4. **Flying Windows Screensaver** (`js/screensaver.js`) - Nostalgic screensaver
5. **GitHub Installer** (`js/program-icons.js`) - Fake installation process animation
6. **Sound Effects** - Toggle-able Windows 95 audio (in `/sounds/`)

## Common Tasks

### Adding a New Desktop Icon
1. Add icon image to `/icons/`
2. Add icon HTML in `index.html` within the desktop area
3. Add click handler in `js/program-icons.js`

### Adding a New Window
1. Add window HTML structure in `index.html` (follow existing window patterns)
2. Add window styling if needed in `css/styles.css`
3. Connect to icon handler in `js/program-icons.js`

### Modifying Menu Bar
Edit `js/win95-components.js` - the `createMenuBar()` function

### Testing Locally
Simply open `index.html` in a browser. No server required for basic functionality. For features requiring data fetching, use a local HTTP server:
```bash
python -m http.server 8000
# or
npx serve .
```

## External Integrations

| Service | Auth | Secrets Required |
|---------|------|------------------|
| Strava API | OAuth 2.0 | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN` |
| Spotify API | OAuth 2.0 | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` |
| Seattle Coffee | Login | `SEATTLE_EMAIL`, `SEATTLE_PASSWORD` |

Secrets are stored in GitHub repository settings.

## Important Files

- **`index.html`** - Main entry point, contains all desktop icons and windows
- **`css/styles.css`** - All Windows 95 styling (~1900 lines)
- **`js/win95-components.js`** - Core UI component logic
- **`js/program-icons.js`** - Desktop icon interaction handlers
- **`js/decrypt.js`** - Startup dialog and decryption feature

## Things to Avoid

- **Don't add build tools** - Keep the simplicity of static HTML/CSS/JS
- **Don't break Win95 aesthetics** - Maintain authentic look and feel
- **Don't commit API credentials** - Use GitHub Secrets
- **Don't manually edit `/data/` files** - They are auto-generated
- **Don't add heavy dependencies** - Keep the site fast and simple

## Deployment

Push to the main branch automatically deploys to GitHub Pages. The `CNAME` file ensures the custom domain `andresmit.co.za` is used.

## File Statistics

| Type | Count |
|------|-------|
| HTML files | 3 |
| CSS files | 2 |
| JavaScript files | 12 |
| Data files | 3 |
| Workflows | 4 |
| Total ~LOC | 5,200+ |
