import { useState, useEffect, useCallback } from "react";
import { Events } from "@wailsio/runtime";
import { 
  SetUserPreference, 
  GetUserPreference, 
  GetVideoRetentionLimit 
} from "../../bindings/tavlio/dbase/store";

export function useSettings() {
  const [retentionDays, setRetentionDays] = useState<string>("3");
  
  const [vlmEnabled, setVlmEnabled] = useState<boolean>(false);
  const [captureEnabled, setCaptureEnabled] = useState<boolean>(false);

  const [vlmStatus, setVlmStatus] = useState<string>("");
  const [captureStatus, setCaptureStatus] = useState<string>("");

  // initial load & event setup
  useEffect(() => {
    let isMounted = true; 

    GetVideoRetentionLimit("video_retention_days", 3)
      .then((days: number) => { if (isMounted) setRetentionDays(days.toString()); })
      .catch(console.error);

    GetUserPreference("vlm_enabled", "false")
      .then((val: string) => { if (isMounted) setVlmEnabled(val === "true"); })
      .catch(console.warn);

    GetUserPreference("capture_enabled", "false")
      .then((val: string) => { if (isMounted) setCaptureEnabled(val === "true"); })
      .catch(console.warn);

    const unsubVLM = Events.On("vlm-download-status", (evt) => {
      if (!isMounted) return;
      const status = evt.data[0];
      setVlmStatus(status);
      if (status === "error") setVlmEnabled(false);
    });

    const unsubFFmpeg = Events.On("ffmpeg-download-status", (evt) => {
      if (!isMounted) return;
      const status = evt.data[0];
      setCaptureStatus(status);
      if (status === "error") setCaptureEnabled(false);
    });

    return () => { 
      isMounted = false; 
      unsubVLM(); 
      unsubFFmpeg(); 
    }; 
  }, []);

  // user action handlers
  const saveRetentionPreference = useCallback((value: number) => {
    SetUserPreference("video_retention_days", value.toString())
      .then(() => window.dispatchEvent(new CustomEvent("retentionChanged", { detail: value })))
      .catch(console.error);
  }, []);

  const toggleVLM = () => {
    if (vlmStatus === "downloading") return;
    const nextState = !vlmEnabled;
    setVlmEnabled(nextState);
    if (!nextState) setVlmStatus("");
    SetUserPreference("vlm_enabled", nextState ? "true" : "false").catch(console.error);
  };

  const toggleCapture = () => {
    if (captureStatus === "downloading") return;
    const nextState = !captureEnabled;
    setCaptureEnabled(nextState);
    if (!nextState) setCaptureStatus("");
    SetUserPreference("capture_enabled", nextState ? "true" : "false").catch(console.error);
  };

  const handleRetentionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRetentionDays(e.target.value.replace(/[^0-9]/g, ''));
  };

  const handleRetentionBlur = () => {
    let val = parseInt(retentionDays, 10);
    if (isNaN(val) || val < 1) val = 1; 
    setRetentionDays(val.toString());
    saveRetentionPreference(val);
  };

  const adjustRetentionDays = (delta: number) => {
    let current = parseInt(retentionDays, 10);
    if (isNaN(current)) current = 1;
    const newVal = Math.max(1, current + delta); 
    setRetentionDays(newVal.toString());
    saveRetentionPreference(newVal);
  };

  return {
    retentionDays,
    vlmEnabled,
    captureEnabled,
    vlmStatus,
    captureStatus,
    toggleVLM,
    toggleCapture,
    handleRetentionChange,
    handleRetentionBlur,
    adjustRetentionDays
  };
}