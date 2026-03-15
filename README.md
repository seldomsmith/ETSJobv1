# ETS Insight Dashboard (Next.js 14)

This project has been pre-configured with a **Slate Aurora** professional theme and is ready for deployment to **GitHub Codespaces**.

## 🏗️ What has been built locally
I have written the core application structure so that it is essentially "plug-and-play" once you move to a Node.js-enabled environment:

- **Theme Engine**: `tailwind.config.ts` and `app/globals.css` are configured with the Slate Aurora palette and custom glassmorphism effects.
- **Layout Architecture**: `app/layout.tsx` handles premium typography (`Inter` & `Outfit`) and root styling.
- **Core Dashboard**: `app/page.tsx` contains the main grid, stats tracking, and responsive layout.
- **Components**: `components/Navbar.tsx` is a fully functional premium navigation bar.
- **Codespace Config**: `.devcontainer/devcontainer.json` is ready to auto-configure your GitHub environment.

## ☁️ Moving to GitHub Codespaces (Required for npm/Node)
Since Node.js is restricted locally, follow these steps to see the live app:

1. **Upload to GitHub**: Create a new repository and push this entire folder.
2. **Launch Codespace**: 
   - On your GitHub repo, click the green **"Code"** button.
   - Select the **"Codespaces"** tab.
   - Click **"Create codespace on main"**.
3. **Environment Auto-Setup**: 
   - The `.devcontainer` I created will automatically install Node.js 20 and all required VS Code extensions.
   - In the terminal, run: `npm install`
   - Then run: `npm run dev`
4. **View App**: Click the "Open in Browser" popup that appears.

## 🛠️ Codespace-Only Components
The following require the Codespace environment to function:
- **Map Engine**: Integration with Mapbox/Leaflet (requires `npm install`).
- **Data Pipeline**: Real-time ETS API calls.
- **Charts**: Interactive graphs using `recharts` or `apexcharts`.

---
*Built with Google Antigravity | ETS & Jobs Analysis 2026*

