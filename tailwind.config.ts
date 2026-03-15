import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#0f172a",
          900: "#1e293b",
          800: "#334155",
        },
        aurora: {
          cyan: "#22d3ee",
          lime: "#98ff98",
          pink: "#f472b6",
          purple: "#a855f7",
        },
      },
      backgroundImage: {
        "aurora-gradient": "linear-gradient(to right, #22d3ee, #98ff98, #f472b6)",
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
      },
    },
  },
  plugins: [],
};
export default config;
