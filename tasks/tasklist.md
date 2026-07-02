# 📋 ETS@Work Upgrades Task List

This task list tracks the progress of the ETS@Work prospecting tool upgrades to our Next.js Mapbox project.

---

## 🗺️ Implementation Checklist

- [x] **Phase 1: Python Data Preprocessing Pipeline**
  - [x] Create `build_ets_work_leads.py`
  - [x] Implement robust CSV parser for `Edmonton_Business_Census_20260521.csv`
  - [x] Filter out `<10` size rows (isolate 21,882 eligible businesses)
  - [x] Build fast Euclidean distance point-to-centroid DAUID lookup
  - [x] Score and tier each business (Tier 1 Prime, Tier 2, Tier 3)
  - [x] Export optimized `ets_at_work_leads.geojson` to public data folder
  - [x] Verify GeoJSON coordinates and data integrity

- [x] **Phase 2: Scrollytelling Map Upgrades**
  - [x] Update `components/ScrollytellingView.tsx` state to load real lead GeoJSON
  - [x] Render businesses as 3D extruded pillars in View 1 (Baseline)
  - [x] Design dynamic color rules: Green (Tier 1), Yellow (Tier 2), Pink (Tier 3)
  - [x] Build glassmorphic sidebar panel with prospecting filters:
    - [x] Min Size filter (10+, 20+, 100+, 500+)
    - [x] Hybrid Work presence toggle
    - [x] Company search bar with auto-fly-to camera animations
  - [x] Implement rich interactive hover tooltip showing real company details and transit access metrics

- [x] **Phase 3: B2B Lead List Dashboard**
  - [x] Redesign `/dashboard` route into a full-scale Prospect Finder page
  - [x] Render high-performance grid table for all filtered business targets
  - [x] Add summary widgets (total leads, prime targets, top wards, top BIAs)
  - [x] Create client-side CSV downloader tool for instant outreach exporting

- [x] **Phase 4: Verification & Delivery**
  - [x] Run automated script tests
  - [x] Validate Mapbox rendering performance (ensure 60fps)
  - [x] Verify CSV export structure
  - [x] Compile complete changes walkthrough in `walkthrough.md`

- [x] **Phase 5: GitHub Sync**
  - [x] Initialize Git repository in `ETSJobv1-main/ETSJobv1-main`
  - [x] Link remote origin to `https://github.com/seldomsmith/ETSJobv1`
  - [x] Stage and commit all active Next.js/Python files
  - [x] Push local `main` branch to GitHub remote repository

- [ ] **Phase 6: 5+ Employee Threshold Integration**
  - [x] Update `build_ets_work_leads.py` to parse '<10' as '5-9' and run pipeline
  - [x] Update `components/ScrollytellingView.tsx` with five min-size pills (5+, 10+, 20+, 100+, 500+)
  - [x] Add 80m 3D extrusion rules for the '5-9' category on Mapbox
  - [x] Redesign `/dashboard` select filter dropdown and logic for 5+ employee targets
  - [x] Commit and push 5+ threshold changes to GitHub repository

- [ ] **Phase 7: App Restructure — ETS@Work Market Research Tab**
  - [x] **Branding**: Rename app from "ETS INSIGHT / Enterprise Transit analytics" → "ETS and Edmonton Jobs Dashboard"
  - [x] **Navbar**: Remove "Export Data" button from header
  - [x] **Navbar**: Rename "Lead Finder" nav item → "ETS@Work Research"
  - [x] **New Page** `/market-research`: Standalone (non-scrollytelling) Mapbox page containing:
    - [x] GTFS transit routes layer (same routes.geojson feed as scrollytelling)
    - [x] All businesses rendered as 3D extruded pillars stacked by employee size
    - [x] ETS@Work filter sidebar (size pills, tier selector, hybrid toggle, search)
    - [x] Prominent CTA button linking through to `/dashboard` (Lead Finder table)
  - [x] **Scrollytelling Cleanup**: Remove ETS@Work filter sidebar from `ScrollytellingView.tsx` (keep map narrative-only)
  - [x] **Navbar routing**: Update "ETS@Work Research" nav link → `/market-research`
  - [x] Commit and push Phase 7 changes to GitHub

- [x] **Phase 8: Settings Panel & Light Theme Toggle**
  - [x] **Settings Button**: Re-integrate settings button or mechanism inside global Header/Navbar.
  - [x] **Settings Modal**: Build a premium modal/slide-out panel containing system settings.
  - [x] **Light Theme Map**: Add light map view option using `mapbox://styles/mapbox/light-v11` (renders white map background).
  - [x] **Navy Transit Lines**: Re-color GTFS routes layer on light theme to deep navy blue for vibrant contrast.
  - [x] **Pinch Darker Tiers**: Darken the 3D pillar fill colors on light theme to preserve clear readability against a white background.
  - [x] **Global Sync**: Connect theme selection state globally across scrollytelling and market research route nodes.

- [x] **Phase 9: Bug Fixes (Map Rendering & Navbar Settings Button)**
  - [x] **Diagnose layout/flex constraints**: Verify dynamic page bounds and overflow.
  - [x] **Implement page wrapper fix**: Modify `/market-research` page wrapper classes to `h-screen overflow-hidden` in `app/market-research/page.tsx`.
  - [x] **Implement Map container fix**: Remove redundant `h-[calc(100vh-76px)]` class and set to `h-full overflow-hidden` in `components/MarketResearchView.tsx`.
  - [x] **Navbar responsiveness fix**: Update `components/Navbar.tsx` to hide "coming soon" badges on smaller/medium viewports (`hidden lg:flex`).
  - [x] **Verify changes**: Conduct full review of layout parameters and class alignment.
  - [x] **Resolve map rendering subset limit**: Remove the 2,500 feature slice limit from `MarketResearchView.tsx` to ensure all 52,027 employers render when "All Targets" is selected.

- [x] **Phase 10: Charts, SVG PNG Export & Global Light Theme**
  - [x] **Page renaming**: Rename `/dashboard` page title to "ETS@Work Target Page".
  - [x] **Dynamic Recharts bar chart**: Display dynamic distribution of matched targets (Tier 1, 2, 3) updating in real-time with filters.
  - [x] **SVG to PNG download utility**: Build SVG-to-Canvas rasterization tool to export dynamic bar charts as PNGs.
  - [x] **True Light Theme integration**: Configure root `.light` class toggling in `Navbar.tsx` to change body and card variables globally.
  - [x] **High-contrast light styling**: Add high-contrast white card, input dropdown, and table overrides in `globals.css`.

- [ ] **Phase 11: Contrast & UI Polish Fixes**
  - [ ] Reset range input styling inside `.light` in `globals.css` to fix slider overlap
  - [ ] Lock navigation header bg and force white/light text inside header bar
  - [ ] Add white card background with dark text for priority suitability tier buttons
  - [ ] Change "Open Prospect finder table" CTA to "Open ETS@Work Targets"
  - [ ] Add high contrast overrides for table rows, headers, and text colors in light mode
  - [ ] Ensure all remaining dark boxes keep white text in light mode

- [x] **Phase 12: Transit Gap Analysis — Bus Stop Proximity & Stranded Jobs**
  - [x] Create `build_bus_stops.py` to parse GTFS feed and compute jobs within 400m of each stop
  - [x] Create `build_gap_hexbins.py` for hexagonal grid transit gap scoring
  - [x] Create `build_gap_isochrones.py` for 3-ring buffer scoring (400m/600m/800m)
  - [x] Create `scripts/generate-stranded-jobs.mjs` (Node.js equivalent for environments without Python)
  - [x] Implement employer size weighting (5-9→7, 10-19→15, 20-99→60, 100-499→300, 500+→500)
  - [x] Build `/bus-stops` page with three view modes:
    - [x] **Stop Proximity**: Bus stops colored by job density within 400m
    - [x] **Hexbin Overlay**: Hexagonal grid colored by transit gap score
    - [x] **Stranded Jobs (3-Rings)**: Individual employer dots scored by nearest stop distance
  - [x] Add "Bus Stops Analysis" link to Navbar
  - [x] Debug and resolve blank Stranded Jobs layer (root cause: generated data files not committed to git)
  - [x] Commit generated data files (`stranded_jobs.geojson`, `stops_with_jobs.geojson`) to repo

- [ ] **Phase 13: On Demand Transit Integration**
  - [ ] Research Edmonton On Demand transit zones, stop points, and service area boundaries
  - [ ] Determine data source (GTFS-Flex, City of Edmonton open data, or manual GeoJSON)
  - [ ] Add On Demand service zones/stops to the Transit Gap Analysis maps
  - [ ] Re-score stranded jobs accounting for On Demand coverage (jobs within an On Demand zone should not be classified as stranded)
  - [ ] Update hexbin gap scores to reflect On Demand availability
  - [ ] Add On Demand layer toggle to the Bus Stops Analysis page UI
  - [ ] Update legend and tooltips to distinguish fixed-route vs On Demand coverage
