// color palette
export const C = {
  highlight:  "#EDE8DE",
  cream:      "#DDD6C8",
  parchment:  "#CEC6B4",
  sand:       "#B8A490",
  rose:       "#B8877A",
  sienna:     "#8C6E5E",
  umber:      "#6A5E54",
  shadow:     "#3A2E26",
  ink:        "#1C1714",
  bg:         "#E4DDD0",
  surface:    "#DDD6C9",
  sidebar:    "#D6CEBC",
  border:     "rgba(90,80,70,0.18)",
  borderHov:  "rgba(90,80,70,0.38)",
} as const;

export const SANS  = "'DM Sans', system-ui, sans-serif";
export const SERIF = "'Playfair Display', Georgia, serif";

export const CHART_STYLE   = { fontFamily: SANS, fontSize: 10 };
export const TOOLTIP_STYLE = {
  background: C.surface,
  border: "1px solid rgba(107,94,82,0.22)",
  borderRadius: 8,
  color: C.ink,
  fontSize: 12,
  fontFamily: SANS,
  padding: "8px 12px",
};
export const AXIS_TICK  = { fill: C.umber, fontSize: 10, fontFamily: SANS };
export const GRID_PROPS = { stroke: "rgba(107,94,82,0.10)", strokeDasharray: "3 3" };

export const VIGNETTE =
  "radial-gradient(ellipse 75% 65% at 8% 7%, rgba(240,235,225,0.60) 0%, transparent 50%), " +
  "radial-gradient(ellipse 55% 55% at 94% 95%, rgba(100,80,65,0.20) 0%, transparent 55%), " +
  "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 38%, rgba(140,120,100,0.10) 100%)";

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const SIDEBAR_W = 252;
