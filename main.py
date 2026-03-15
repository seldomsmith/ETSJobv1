from fasthtml.common import *

# --- Slate Aurora Color Palette ---
# Background: Slate-950 (#0f172a)
# Card BG: Slate-900 (#1e293b)
# Primary Accent: Aurora Cyan (#22d3ee)
# Secondary Accent: Electric Lime (#98FF98)
# Gradient: Cyan -> Purple -> Magenta

app, rt = fast_app(
    hdrs=(
        Link(rel="stylesheet", href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"),
        Style("""
            :root {
                --slate-950: #0f172a;
                --slate-900: #1e293b;
                --aurora-cyan: #22d3ee;
                --aurora-lime: #98ff98;
                --aurora-pink: #f472b6;
            }
            body {
                background-color: var(--slate-950);
                color: #f1f5f9;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .glass-card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
            }
            .aurora-text {
                background: linear-gradient(90deg, var(--aurora-cyan), var(--aurora-lime), var(--aurora-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-weight: 800;
            }
            .aurora-border {
                position: relative;
                padding: 1px;
                background: linear-gradient(45deg, var(--aurora-cyan), var(--aurora-pink));
                border-radius: 13px;
            }
            .aurora-border > div {
                background: var(--slate-950);
                border-radius: 12px;
            }
            .glow-cyan {
                box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
            }
        """),
    )
)

@rt("/")
def get():
    return Title("ETS Insight | Slate Aurora"), Container(
        # Header
        Nav(
            Div(Span("ETS", className="aurora-text text-2xl"), Span(" INSIGHT", className="text-white text-2xl font-light tracking-widest"), className="flex items-center space-x-2"),
            Ul(
                Li(A("Dashboard", href="#", className="text-cyan-400 hover:text-white transition-colors")),
                Li(A("Route Performance", href="#", className="text-slate-400 hover:text-white transition-colors")),
                Li(A("Network Analysis", href="#", className="text-slate-400 hover:text-white transition-colors")),
                className="flex space-x-8"
            ),
            className="flex justify-between items-center py-8 mb-12 border-b border-slate-800"
        ),
        
        # Hero Section
        Div(
            H1("Transit Equity & Employment access", className="text-5xl font-bold mb-4"),
            P("Visualizing the intersection of ETS transit reliability and job center accessibility.", className="text-slate-400 text-lg max-w-2xl"),
            className="mb-16"
        ),
        
        # Dashboard Grid
        Div(
            # Card 1: Route Reliability
            Div(
                H3("Route Reliability", className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-4"),
                Div("94.2%", className="text-4xl font-bold text-white mb-2"),
                Div("+2.4% from last month", className="text-aurora-lime text-sm"),
                className="glass-card p-6 glow-cyan"
            ),
            
            # Card 2: Jobs Access (Current)
            Div(
                H3("Jobs Within 30min", className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-4"),
                Div("124,500", className="text-4xl font-bold text-white mb-2"),
                Div("City-wide average: 89k", className="text-slate-500 text-sm"),
                className="glass-card p-6"
            ),
            
            # Card 3: Equity Index
            Div(
                H3("Equity Resilience", className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-4"),
                Div("0.78", className="text-4xl font-bold text-white mb-2"),
                Div(className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-4", style="height: 4px;").append(
                    Div(className="h-full bg-gradient-to-r from-cyan-400 to-pink-500", style="width: 78%")
                ),
                className="glass-card p-6"
            ),
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        ),
        
        # Bottom Layout
        Div(
            Div(
                H2("Network Accessibility Heatmap", className="text-xl font-bold mb-6"),
                Div(
                    P("Map visualization goes here...", className="text-slate-500 italic"),
                    className="h-96 w-full bg-slate-900/50 rounded-xl flex items-center justify-center border border-slate-800"
                ),
                className="glass-card p-8 col-span-2"
            ),
            Div(
                H2("Key Alerts", className="text-xl font-bold mb-6"),
                Ul(
                    Li(
                        Div("Route 502 Delay", className="font-bold text-pink-400"),
                        P("Construction on 104 Ave affecting reliability.", className="text-xs text-slate-400"),
                        className="p-4 bg-white/5 rounded-lg mb-4"
                    ),
                    Li(
                        Div("New Service Area", className="font-bold text-cyan-400"),
                        P("Expansion to Windermere Job Center live.", className="text-xs text-slate-400"),
                        className="p-4 bg-white/5 rounded-lg"
                    ),
                ),
                className="glass-card p-8"
            ),
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        ),
        
        # Footer
        Footer(
            P("© 2026 ETS & Jobs - Powered by Google Antigravity & FastHTML", className="text-slate-500 text-sm"),
            className="mt-20 py-8 border-t border-slate-800 text-center"
        ),
        className="max-w-6xl mx-auto px-4 pb-20"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
