# Lessons Learned & Prevention Rules

This log documents corrections and lessons to prevent recurring mistakes in future turns, aligning with our workflow orchestration rules.

## 1. Artifact Path Integrity (2026-05-21)

*   **Correction**: A `write_to_file` call failed because it attempted to write a task artifact using an absolute path directed under the global NPM installation folder (`AppData\Roaming\npm\node_modules\antigravity\...`).
*   **Root Cause**: Incorrect mapping of the artifact directory when resuming a turn.
*   **Resolution Rules**:
    1.  All model-generated artifacts must reside strictly in the workspace-specific appData folder: `C:\Users\matdow\.gemini\antigravity\brain\745f51b6-9f36-4148-9bbb-11ee65e593f2/`.
    2.  Always double-check the artifact path against the App Data Directory configuration listed in user metadata before calling the `write_to_file` tool.
