import { useState, useEffect } from "react";
import { C, SANS, SERIF } from "../theme";
import { Card, CardLabel, EmptyChart } from "../components/Primitives";
import { I } from "../components/Icons";

import { GetRecentLogs } from "../../bindings/tavlio/dbase/store";

interface RecentLog { App: string; Desc: string; Time: string; Status: string; }

export function RecentLogs() {
  const [logs, setLogs]       = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  // safe async fetching
  useEffect(() => {
    let isMounted = true;

    GetRecentLogs(10)
      .then(rows => {
        if (isMounted) setLogs(rows ?? []);
      })
      .catch(() => {
        if (isMounted) setLogs([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const isEmpty = !loading && logs.length === 0;

  return (
    <Card wide>
      <CardLabel>Recent context snapshots</CardLabel>

      {loading ? (
        <EmptyChart height={120} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={120} message="Snapshots will appear here as Tavlio runs in the background" />
      ) : (
        // create a scrolling container
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          maxHeight: "360px", 
          overflowY: "auto",
          paddingRight: 8 // Keeps scrollbar off the text
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < logs.length - 1 ? "1px solid rgba(107,94,82,0.1)" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(107,94,82,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: SERIF, fontSize: 12, color: C.shadow }}>{log.App[0]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.Desc}</div>
                <div style={{ fontFamily: SANS, fontSize: 10, color: C.umber, marginTop: 2 }}>{log.App}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                <span style={{ color: log.Status === "processed" ? "#7BA05B" : C.umber }}>{I.dot()}</span>
                <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber }}>{log.Time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}