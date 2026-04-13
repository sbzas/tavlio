import { C } from "../../theme";
import { I } from "../../components/Icons";

interface Props {
  children: React.ReactNode;
  onRemove: () => void;
  style?: React.CSSProperties;
}

export function RemovableWidget({ children, onRemove, style }: Props) {
  return (
    <div className="removable-widget" style={{ position: "relative", height: "100%", ...style }}>
      {children}
      <button
        className="remove-btn"
        onClick={onRemove}
        title="Remove widget"
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 10,
          width: 20, height: 20, borderRadius: "50%",
          display: "none", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: C.umber,
          boxShadow: "0 1px 4px rgba(60,50,40,0.12)",
        }}
      >
        {I.x(8)}
      </button>
    </div>
  );
}