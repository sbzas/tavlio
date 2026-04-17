import { useState, useEffect } from "react";
import { GetUserPreference, SaveDashboardState } from "../../../bindings/tavlio/dbase/store";
import { type DashState, DEFAULT_BUILTINS } from "./DashboardUtils";

export function useDashboardState() {
  const [state, setState] = useState<DashState>({ builtins: [], pinnedApps: [] });
  const [isLoading, setLoader] = useState(true);

  // Load from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    GetUserPreference("dashboard_state", "").then((raw: string) => {
      if (!isMounted) return;
      if (raw) {
        try {
          setState(JSON.parse(raw));
        } catch (e) {
          setState({ builtins: DEFAULT_BUILTINS, pinnedApps: [] });
        }
      } else {
        setState({ builtins: DEFAULT_BUILTINS, pinnedApps: [] });
      }
      setLoader(false);
    });
    return () => { isMounted = false; };
  }, []);

  // Update state helper (save to DB concurrently)
  const updateState = (updater: (s: DashState) => DashState) => {
    setState(prev => {
      const next = updater(prev);
      SaveDashboardState(JSON.stringify(next)).catch(console.error);
      return next;
    });
  };

  return { state, isLoading, updateState };
}