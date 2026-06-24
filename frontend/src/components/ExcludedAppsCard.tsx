import { useState, useRef, useEffect, useMemo } from "react";
import { C, SANS } from "../theme";
import { I } from "./Icons";
import { ExclusionColumn } from "./ExcludedAppsColumn";
import {
  GetAllTrackedApps,
  GetExcludedApps,
  SetAppExclusion,
  RemoveAppExclusion,
} from "../../bindings/tavlio/dbase/store";
import type { ExcludedApp } from "../../bindings/tavlio/dbase/models";

type ExclusionType = "hard" | "soft";

// internal shape mirroring the generated ExcludedApp model
interface ExcludedRow {
  name: string;
  type: ExclusionType;
}

export function ExcludedAppsCard() {
  const [query, setQuery]           = useState("");
  const [focused, setFocused]       = useState(false);
  const [trackedApps, setTrackedApps] = useState<string[]>([]);
  const [excluded, setExcluded]     = useState<ExcludedRow[]>([]);

  // the app the user picked from the suggestions, awaiting a type choice
  const [pendingApp, setPendingApp] = useState<string | null>(null);

  const inputRef      = useRef<HTMLInputElement>(null);
  const suggestRef    = useRef<HTMLDivElement>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // ---- data load ----
  const refresh = () => {
    GetAllTrackedApps().then((names: string[]) => setTrackedApps(names)).catch(console.warn);
    GetExcludedApps().then((rows: ExcludedApp[]) => {
      setExcluded(rows.map(r => ({ name: r.Name, type: r.ExclusionType as ExclusionType })));
    }).catch(console.warn);
  };

  useEffect(() => { refresh(); }, []);

  const excludedNames = useMemo(() => new Set(excluded.map(e => e.name)), [excluded]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trackedApps
      .filter(n => !excludedNames.has(n))
      .filter(n => q === "" || n.toLowerCase().includes(q));
  }, [query, trackedApps, excludedNames]);

  const hardList  = excluded.filter(e => e.type === "hard").map(e => e.name);
  const softList = excluded.filter(e => e.type === "soft").map(e => e.name);

  // ---- handlers ----

  const resetInput = () => {
    setPendingApp(null);
    setQuery("");
    setSuggestOpen(false);
  };
  
  const pickApp = (name: string) => {
    setPendingApp(name);
    setQuery(name);
    setSuggestOpen(false);
  };

  const confirmType = (type: ExclusionType) => {
    if (!pendingApp) return;
    SetAppExclusion(pendingApp, type)
      .then(() => { refresh(); resetInput(); })
      .catch(console.error);
  };

  const removeExclusion = (name: string) => {
    RemoveAppExclusion(name).then(refresh).catch(console.error);
  };

  // close suggestions / pending type-picker on outside click
  useEffect(() => {
    if (!suggestOpen && !pendingApp) return;
    const h = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
        if (pendingApp) resetInput();
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [suggestOpen, pendingApp]);

  return (
    <div style={{ width: "100%", padding: "14px 20px", fontFamily: SANS, color: C.shadow }}>
      {/* ---- search input ---- */}
      <div ref={suggestRef} style={{ position: "relative" }}>
        <div style={{
          background: focused ? "rgba(255,252,244,0.9)" : "rgba(107,94,82,0.05)",
          border: "1px solid " + (focused ? C.borderHov : C.border),
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
          transition: "all 0.18s",
          boxShadow: focused ? "0 0 0 3px rgba(107,94,82,0.08)" : "none",
        }}>
          <span style={{ color: C.umber, display: "flex" }}>{I.search(13)}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setPendingApp(null); setSuggestOpen(true); }}
            onFocus={() => { setFocused(true); setSuggestOpen(true); }}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === "Escape") resetInput(); }}
            placeholder="Type an app to exclude…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: C.ink, fontSize: 13, fontFamily: SANS, caretColor: C.sienna,
            }}
          />
          {pendingApp === null && query && (
            <button
              onClick={resetInput}
              style={{ border: "none", background: "transparent", color: C.umber, cursor: "pointer", padding: 0, display: "flex" }}
            >{I.x(13)}</button>
          )}
        </div>

        {/* ---- floating dropdown: suggestions OR type picker ---- */}
        {((suggestOpen && !pendingApp && suggestions.length > 0) || pendingApp) && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: C.cream, border: "1px solid " + C.borderHov, borderRadius: 10,
            boxShadow: "0 10px 30px rgba(60,50,40,0.16)",
            maxHeight: 200, overflowY: "auto",
          }}>
            {/* suggestions list (before an app is chosen) */}
            {!pendingApp && suggestions.map(n => (
              <button
                key={n}
                onClick={() => pickApp(n)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  padding: "8px 12px", color: C.shadow, fontSize: 12.5, fontFamily: SANS,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(107,94,82,0.09)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ color: C.umber, display: "flex" }}>{I.dot(6)}</span>
                {n}
              </button>
            ))}

            {/* type picker (after an app is chosen) */}
            {pendingApp && (
              <div style={{ padding: "10px 12px" }}>
                {/* header row: label + cancel at top-right */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 11, color: C.umber, fontStyle: "italic" }}>
                    Exclude <b style={{ color: C.shadow }}>{pendingApp}</b> as:
                  </span>
                  <button onClick={resetInput}
                    style={{ border: "none", background: "transparent", color: C.umber, cursor: "pointer", fontSize: 11, fontFamily: SANS, padding: 0, display: "flex", lineHeight: 0 }}
                    title="Cancel"
                  >{I.x(13)}</button>
                </div>
                {/* each pill on its own row */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <TypePill label="Hard" icon={I.shield(12)} active={false}
                    desc="No tracking" onClick={() => confirmType("hard")} />
                  <TypePill label="Soft" icon={I.eyeOff(12)} active={false}
                    desc="Hidden only" onClick={() => confirmType("soft")} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- excluded lists, two columns ---- */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ExclusionColumn
          title="Hard excluded"
          icon={I.shield(12)}
          color={C.rose}
          apps={hardList}
          onRemove={removeExclusion}
          emptyText="Nothing hidden from tracking"
        />
        <ExclusionColumn
          title="Soft excluded"
          icon={I.eyeOff(12)}
          color={C.sienna}
          apps={softList}
          onRemove={removeExclusion}
          emptyText="Nothing tracked-but-hidden"
        />
      </div>
    </div>
  );
}

// ---- pill used to pick the exclusion type ----
function TypePill({ label, icon, desc, active, onClick }: {
  label: string; icon: React.ReactElement; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        border: "1px solid " + (active ? C.sienna : C.border), borderRadius: 999,
        padding: "4px 10px", fontFamily: SANS, fontSize: 11.5, color: active ? C.highlight : C.shadow,
        background: active ? C.sienna : "rgba(107,94,82,0.05)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = C.borderHov; e.currentTarget.style.background = "rgba(107,94,82,0.1)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(107,94,82,0.05)"; } }}
    >
      <span style={{ display: "flex", color: active ? C.highlight : C.umber }}>{icon}</span>
      <span>{label}</span>
      <span style={{ fontSize: 9.5, color: active ? "rgba(237,232,222,0.7)" : C.umber, fontStyle: "italic" }}>{desc}</span>
    </button>
  );
}