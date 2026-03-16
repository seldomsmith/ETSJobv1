# 🗺️ Next Steps: ETS & Jobs Dashboard

Now that your **Slate Aurora** dashboard shell is running in Codespaces, here is your roadmap for building out the visual analytics.

---

## 📊 Phase 1: Data Integration (Local -> Next.js)
To power the dashboard cards and maps with real Edmonton data:

1.  **Move Data into the Project**:
    *   Place your `.json`, `.csv`, or `.geojson` Files into `/public/data/` (e.g., `public/data/jobs_mesh.geojson`).
2.  **Create a Data Fetch Handle**:
    *   In Next.js 14, you can create an API endpoint to read server-side data quickly for client components.
    *   *Path*: `app/api/data/route.ts`
    *   *Concept*: Load static files using Node's `fs` module to securely serve heavy files.

---

## 🗺️ Phase 2: Load the Accessibility Map (High Priority)
To remove the "Initializing Map Engine" placeholder card:

1.  **Pick a Map Library**:
    *   Run inside your Codespace terminal:
        ```bash
        npm install react-map-gl mapbox-gl
        ```
2.  **Configure Mapbox Environment**:
    *   If using Mapbox, create a `.env.local` file at the root.
    *   Add: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here`
3.  **Build a Map View component**:
    *   Create `components/AccessibilityMap.tsx` and load your GeoJSON data vectors with a smooth gradient heat overlay matching the Slate Aurora theme.

---

## 📈 Phase 3: Charts & Analytical Views
To display rich trends for things like commute times and equity scores:

1.  **Install Recharts**:
    *   Run:
        ```bash
        npm install recharts
        ```
2.  **Build visual trends**:
    *   Create graph components (for Area Charts or Bar Charts) displaying relative accessibility index over time.
    *   Apply theme colors: `fill="#22d3ee"` (Cyan) or `stroke="#f472b6"` (Pink).

---

## 📜 Phase 4: Scrollytelling Transitions (Narratives)
If your report is narrative-based (Scrolling down updates map panels):

1.  **Framer Motion Animation Tool**:
    *   Run:
        ```bash
        npm install framer-motion
        ```
2.  **Scroll trigger layout**:
    *   Structure your main layout as updates relying on current scroll heights with `scroll-snap` or Intersection Observers to trigger dynamic map overlays.

---

💡 **Recommendation**: Start by dropping some spatial `.geojson` or coordinate lists into `/public/data` so we have real metrics to link into our dashboard variables.
