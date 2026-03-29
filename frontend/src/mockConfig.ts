// config lookup tables

import type { CalEvent } from "./types";
import { C } from "./theme";

// placeholder tints
export const APP_TINTS: Record<string, string> = {
  "VS Code":         "#4A8FC9",
  "Google Chrome":   "#C94A4A",
  "Firefox":         "#E8823A",
  "Figma":           "#9B59B6",
  "Slack":           "#4CAF7A",
  "Terminal":        "#C9A24A",
  "iTerm2":          "#C9A24A",
  "Notion":          "#A07858",
  "Safari":          "#4A9BC9",
  "Xcode":           "#6B8FC9",
  "Zoom":            "#2D8CFF",
  "Discord":         "#5865F2",
  "Spotify":         "#1DB954",
  "Steam":           "#1B2838",
  "Obsidian":        "#7B68EE",
  "IntelliJ IDEA":   "#FE315D",
  "Microsoft Teams": "#6264A7",
  "Mail":            "#4A90C9",
  "Apple Music":     "#FC3C44",
  "Postman":         "#FF6C37",
};

// placeholder "intended" calendar events
export const INTENDED_EVENTS: CalEvent[] = [
  { id:"i1", label:"Deep work — feature dev",  start:540,  end:720,  color:C.sienna,    type:"intended" },
  { id:"i2", label:"Team standup",              start:720,  end:750,  color:C.sand,      type:"intended" },
  { id:"i3", label:"Design review",             start:810,  end:870,  color:C.rose,      type:"intended" },
  { id:"i4", label:"Lunch break",               start:750,  end:810,  color:C.parchment, type:"intended" },
  { id:"i5", label:"Code review block",         start:870,  end:990,  color:C.sienna,    type:"intended" },
  { id:"i6", label:"1:1 with manager",          start:990,  end:1020, color:C.sand,      type:"intended" },
  { id:"i7", label:"Focus block — writing",     start:1020, end:1140, color:C.sienna,    type:"intended" },
];

export function fmt(mins: number): string {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
