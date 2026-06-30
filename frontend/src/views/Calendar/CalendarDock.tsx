import { useState } from "react";
import { C, SANS } from "../../theme";
import { I } from "../../components/Icons";
import { IconList, IconCircleMinus, IconCircleCheck } from "@tabler/icons-react";
import { S, GRID_H } from "./CalendarUtils";
import type { ExternalCal } from "../../../bindings/tavlio/dbase/models";

export function CalendarDock({
  calendars,
  hiddenCalIds,
  onToggle,
  onDelete,
  onClose,
}: {
  calendars:  ExternalCal[];
  hiddenCalIds: number[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const [hoveredCalId, setHoveredCalId] = useState<number | null>(null);

  const providerLabel = (p: string) => (p === "caldotcom" ? "Cal.com" : p);

  return (
    <div style={{
      width: 240, borderLeft: "1px solid " + C.border, background: C.surface,
      display: "flex", flexDirection: "column", flexShrink: 0, height: GRID_H, zIndex: 10
    }}>
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid " + C.border,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ ...S.capsLabel, color: C.umber, fontWeight: "bold" }}>Your External Calendars</span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: C.umber, cursor: "pointer", display: "flex", padding: 0 }}
        >
          {I.x(11)}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {calendars.map(cal => {
          const isHidden  = hiddenCalIds.includes(cal.id);
          const isHovered = hoveredCalId === cal.id;

          return (
            <div
              key={cal.id}
              onMouseEnter={() => setHoveredCalId(cal.id)}
              onMouseLeave={() => setHoveredCalId(null)}
              style={{
                padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", borderBottom: "1px solid rgba(90,80,70,0.06)",
                background: isHovered ? "rgba(90,80,70,0.06)" : "transparent",
                transition: "background 0.15s", position: "relative"
              }}
              onClick={() => onToggle(cal.id)}
            >
              {/* Hover delete button on the left */}
              <div style={{
                width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                opacity: isHovered ? 1 : 0, transition: "opacity 0.15s", zIndex: 5,
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to disconnect and delete this calendar?")) {
                      onDelete(cal.id);
                    }
                  }}
                  style={{
                    background: "none", border: "none", cursor: "pointer", color: C.rose,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 0
                  }}
                  title="Delete Calendar"
                >
                  <IconCircleMinus size={14} />
                </button>
              </div>

              {/* Active/hidden status indicator */}
              {!isHovered && (
                <div style={{ color: isHidden ? "rgba(107,94,82,0.3)" : "#7BA05B", display: "flex", width: 18, justifyContent: "center" }}>
                  {isHidden
                    ? <IconCircleMinus size={14} style={{ color: "rgba(107,94,82,0.3)" }} />
                    : <IconCircleCheck size={14} />}
                </div>
              )}

              {/* Calendar details */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{
                  fontFamily: SANS, fontSize: 12, fontWeight: 500, color: isHidden ? C.umber : C.ink,
                  textDecoration: isHidden ? "line-through" : "none",
                  textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"
                }}>
                  {cal.name}
                </span>
                <span style={{
                  fontFamily: SANS, fontSize: 9, color: C.umber,
                  textTransform: "capitalize", opacity: 0.8
                }}>
                  {providerLabel(cal.provider)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// re-exported so the header toggle button shares the same icon
export { IconList };
