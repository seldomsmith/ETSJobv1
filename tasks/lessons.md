# Lessons Learned & Prevention Rules

This log documents corrections and lessons to prevent recurring mistakes in future turns, aligning with our workflow orchestration rules.

## 1. Artifact Path Integrity (2026-05-21)

*   **Correction**: A `write_to_file` call failed because it attempted to write a task artifact using an absolute path directed under the global NPM installation folder (`AppData\Roaming\npm\node_modules\antigravity\...`).
*   **Root Cause**: Incorrect mapping of the artifact directory when resuming a turn.
*   **Resolution Rules**:
    1.  All model-generated artifacts must reside strictly in the workspace-specific appData folder: `C:\Users\matdow\.gemini\antigravity\brain\745f51b6-9f36-4148-9bbb-11ee65e593f2/`.
    2.  Always double-check the artifact path against the App Data Directory configuration listed in user metadata before calling the `write_to_file` tool.

## 2. Remote Environments and Local Git Syncing (2026-05-27)

*   **Correction**: The user reported "Still no change" after files were committed and pushed locally, because the remote running environment (e.g. GitHub Codespaces) had not pulled the latest commits.
*   **Root Cause**: Local filesystem updates do not automatically sync to remote active web servers unless the environment explicitly fetches and merges the latest commits.
*   **Resolution Rules**:
    1.  When developing in a dual local/remote setup where Node/npm is restricted locally, remind the user to run `git pull` in their active running environment (e.g. Codespace terminal) after pushes are made from the local machine.
    2.  Provide clear, step-by-step update instructions for the respective environment (Codespaces, Cloud Run, Vercel) immediately after executing commits/pushes.

## 3. Python-Generated Data Files Must Be Committed to Git (2026-07-01)

*   **Symptom**: The "Stranded Jobs" Mapbox layer rendered a completely blank map despite correct React/Mapbox code. The layer worked perfectly when pointed at `ets_at_work_leads.geojson` (committed file) but showed nothing when pointed at `stranded_jobs.geojson` (Python-generated file).
*   **Root Cause**: The Python build scripts (`build_bus_stops.py`, `build_gap_hexbins.py`, `build_gap_isochrones.py`) generated data files into `public/data/` inside the Codespace, but those files were never `git add`ed or committed. They existed only in the Codespace's local filesystem. Since Next.js serves static files from `public/`, and the file wasn't there in the git-tracked tree, the browser received a 404. Mapbox silently swallowed the 404 and rendered nothing.
*   **Debugging steps that wasted time**:
    1.  Suspected Mapbox `match` vs `step` float precision (wrong).
    2.  Added `Date.now()` cache buster to the URL, which caused Mapbox to infinitely reload the source on every React render cycle (made it worse).
    3.  Changed to a static `?v=2` cache buster (didn't help because the file literally didn't exist).
*   **What actually diagnosed it**: Swapping the `<Source data=...>` URL to point at `ets_at_work_leads.geojson` (a file we KNEW was committed). Black dots appeared immediately, proving the component was fine and the file was the problem. Then listing `public/data/` confirmed `stranded_jobs.geojson` was absent.
*   **Resolution Rules**:
    1.  **Any script that generates static data files must be followed by a `git add` + `git commit` step.** Generated data files that Next.js needs to serve MUST be in the repo.
    2.  **When a Mapbox layer is blank, the first diagnostic step is always: does the file exist and is it being served?** Check the browser Network tab for 404s, or swap the source URL to a known-good file.
    3.  **Never use `Date.now()` or any dynamic expression inside a Mapbox `<Source data={...}>` URL.** React re-renders cause the URL to change every frame, and Mapbox aborts the previous fetch to start a new one, resulting in an infinite loop of failed loads.
    4.  **Write a Node.js equivalent** (`scripts/generate-stranded-jobs.mjs`) for any Python data pipeline so it can run in environments without Python.

## 4. Next.js Static File Caching in Development (2026-07-01)

*   **Correction**: Even after generating files into `public/data/` while the Next.js dev server was running, the server sometimes continued returning 404 for those files.
*   **Root Cause**: Next.js development server caches the `public/` directory manifest at startup. Files created after the server starts may not be detected until the server is fully restarted (`Ctrl+C` then `npm run dev`).
*   **Resolution Rules**:
    1.  After generating any new file in `public/`, always kill and restart the Next.js dev server.
    2.  A browser hard-refresh (`Ctrl+Shift+R`) alone is not sufficient; the server process itself must be restarted.
