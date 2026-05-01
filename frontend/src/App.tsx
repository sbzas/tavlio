import { useState, useEffect, useRef, useCallback } from "react";
import { C, SANS, SERIF, VIGNETTE, GRAIN, SIDEBAR_W } from "./theme";
import type { AppEntry } from "./types";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { Sidebar } from "./views/Settings";
import { SearchBar }  from "./components/SearchBar";
import { NavDock }    from "./components/NavDock";
import { AIModal }    from "./components/AIModal";
import { Divider }    from "./components/Primitives";
import { DashboardView } from "./views/Dashboard/DashboardView";
import { ArchivesView }  from "./views/ArchivesView";
import { AppDetailView } from "./views/AppDetailView";
import { CalendarView }  from "./views/Calendar/CalendarView";
import { I } from "./components/Icons";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView]               = useState("dashboard");
  const [collapsed, setCollapsed]     = useState(false);
  const [aiQuery, setAiQuery]         = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const w         = useWindowWidth();

  // On narrow screens the sidebar overlays rather than pushing content
  const frameLeft      = sidebarOpen && w >= 768 ? SIDEBAR_W + 8 : 8;
  const sidebarOverlay = sidebarOpen && w < 768;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = () => setCollapsed(el.scrollTop > 80);
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  // Close sidebar when viewport shrinks below tablet breakpoint
  useEffect(() => { if (w < 768) setSidebarOpen(false); }, [w]);

  const handleNav    = (v: string) => { setView(v); setSelectedApp(null); };
  const handleSearch = useCallback((q: string) => setAiQuery(q), []);

  const px = w < 480 ? "14px" : "26px";
  const py = w < 480 ? "24px" : "30px";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: ${C.parchment}; color: ${C.ink}; font-family: ${SANS}; }
        * { scrollbar-width: none; -ms-overflow-style: none; user-select: none; -webkit-user-select: none; }
        *::-webkit-scrollbar { display: none; }
        ::placeholder { color: ${C.umber}; }
        input, button { font-family: ${SANS}; }
        input, textarea { user-select: text; -webkit-user-select: text; }
        button { cursor: pointer; }
        ::selection { background: ${C.sand}; color: ${C.ink}; }
        @keyframes slideInPanel {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .session-detail-panel {
          animation: slideInPanel 0.28s cubic-bezier(.4,0,.2,1) both;
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 999, pointerEvents: "none", opacity: 0.035, backgroundImage: GRAIN }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: VIGNETTE }} />

      {/* Backdrop blur when sidebar overlays on narrow screens */}
      {sidebarOverlay && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        />
      )}

      {/* handle for indicating there's something at the left of the screen (the sidebar) */}
      <div
        style={{
          position: "fixed", 
          top: "50%", 
          left: sidebarOpen ? SIDEBAR_W : 0, 
          transform: "translateY(-50%)",
          width: 20, 
          height: 48,
          background: C.sidebar, 
          border: `1px solid ${C.border}`,
          borderLeft: "none", // Blends seamlessly into the sidebar's right border
          borderRadius: "0 6px 6px 0",
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center",
          zIndex: 105, // Sits just above the sidebar (zIndex 100)
          color: C.umber, 
          transition: "left 0.28s cubic-bezier(.4,0,.2,1)", 
          pointerEvents: "none",
          boxShadow: "2px 0 8px rgba(107,94,82,0.06)" 
        }}
      >
        {I.dotsV(16)}
      </div>

      {/* hover driven sidebar */}
      <Sidebar
        open={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content frame */}
      <div style={{
        position: "fixed", top: 8, right: 8, bottom: 8, left: frameLeft,
        borderRadius: 16, overflow: "hidden", background: C.bg,
        boxShadow: "0 0 0 1px rgba(107,94,82,0.18), 0 8px 40px rgba(107,94,82,0.18)",
        transition: "left 0.28s cubic-bezier(.4,0,.2,1), filter 0.28s",
        zIndex: 1, filter: sidebarOpen ? "blur(3px)" : "none",
      }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", backgroundImage: VIGNETTE, opacity: 0.9 }} />

        <div ref={scrollRef} style={{ height: "100%", overflowY: "auto", position: "relative", zIndex: 3 }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: `${py} ${px}` }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26 }}>
              <div>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: w < 480 ? 22 : 28, color: C.shadow, lineHeight: 1 }}>
                  Tavlio
                </div>
                <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 9, color: C.umber, letterSpacing: "0.13em", textTransform: "uppercase", marginTop: 5 }}>
                  A library of your atavisms
                </div>
              </div>
              {w >= 560 && (
                <div style={{ fontFamily: SANS, fontSize: 10, color: C.sienna }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </div>

            <SearchBar collapsed={false} onSearch={handleSearch} />
            <Divider />

            {view === "dashboard" && <DashboardView />}
            {view === "archives" && !selectedApp && (
              <ArchivesView
                onSelectApp={app => {
                  setSelectedApp(app);
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
            {view === "archives" && selectedApp && (
              <AppDetailView
                app={selectedApp}
                onBack={() => {
                  setSelectedApp(null);
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
            {view === "calendar" && <CalendarView />}
          </div>
        </div>
      </div>

      {collapsed && <SearchBar collapsed onSearch={handleSearch} />}
      <NavDock active={view} onNav={handleNav} />
      {aiQuery && <AIModal query={aiQuery} onClose={() => setAiQuery(null)} />}
    </>
  );
}
