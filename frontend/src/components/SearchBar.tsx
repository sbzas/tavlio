import { useState, useRef, useEffect, useCallback } from "react";
import { C, SANS } from "../theme";
import { I } from "./Icons";

interface SearchBarProps {
  collapsed: boolean;
  onSearch: (q: string) => void;
}

export function SearchBar({ collapsed, onSearch }: SearchBarProps) {
  const [query, setQuery]       = useState("");
  const [focused, setFocused]   = useState(false);
  const [bubbleOpen, setBubble] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        collapsed ? setBubble(true) : inputRef.current?.focus();
      }
      if (e.key === "Escape") setBubble(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [collapsed]);

  useEffect(() => {
    if (bubbleOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [bubbleOpen]);

  const submit = useCallback(() => {
    if (query.trim()) { onSearch(query.trim()); setQuery(""); setBubble(false); }
  }, [query, onSearch]);

  if (collapsed) {
    return (
      <>
        <button
          onClick={() => setBubble(true)}
          style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 150, background: C.highlight, border: "1px solid " + C.border, borderRadius: 999, padding: "8px 16px 8px 12px", display: "flex", alignItems: "center", gap: 8, color: C.umber, fontSize: 12, cursor: "pointer", backdropFilter: "blur(8px)", fontFamily: SANS, letterSpacing: "0.04em", boxShadow: "0 4px 16px rgba(107,94,82,0.18)" }}
        >
          {I.search(13)} Ask Tavlio
          <span style={{ fontSize: 10, color: C.umber, background: "rgba(107,94,82,0.14)", padding: "2px 6px", borderRadius: 4 }}>⌘K</span>
        </button>
        {bubbleOpen && (
          <div
            onClick={() => setBubble(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 58, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: C.cream, border: "1px solid " + C.borderHov, borderRadius: 14, width: "min(520px, 90vw)", padding: "14px 18px", boxShadow: "0 12px 40px rgba(60,50,40,0.18)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.umber, display: "flex" }}>{I.search(14)}</span>
                <input
                  ref={inputRef} value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  placeholder="Ask anything about your habits…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 14, fontFamily: SANS, caretColor: C.sienna }}
                />
                <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber, background: "rgba(90,80,70,0.12)", padding: "2px 7px", borderRadius: 4 }}>⌘K</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ background: focused ? "rgba(255,252,244,0.9)" : C.surface, border: "1px solid " + (focused ? C.borderHov : C.border), borderRadius: 12, display: "flex", alignItems: "center", gap: 11, padding: "11px 16px", transition: "all 0.2s", boxShadow: focused ? "0 0 0 3px rgba(107,94,82,0.08)" : "none" }}>
      <span style={{ color: C.umber, display: "flex" }}>{I.search(14)}</span>
      <input
        ref={inputRef} value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Ask anything about your habits…"
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 13, fontFamily: SANS, caretColor: C.sienna }}
      />
      <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber, background: "rgba(107,94,82,0.12)", padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>⌘K</span>
      <button
        onClick={submit}
        style={{ fontFamily: SANS, background: C.sienna, border: "none", borderRadius: 8, padding: "6px 14px", color: C.highlight, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Analyse →
      </button>
    </div>
  );
}
