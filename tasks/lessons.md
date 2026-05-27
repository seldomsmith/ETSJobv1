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

