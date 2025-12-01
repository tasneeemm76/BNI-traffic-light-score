"use client";

type AlertProps = {
  type: "success" | "error" | "info" | "warning";
  message: string;
  onClose?: () => void;
};

export function Alert({ type, message, onClose }: AlertProps) {
  const colors = {
    success: { bg: "#d4edda", text: "#155724", border: "#c3e6cb", icon: "✅" },
    error: { bg: "#f8d7da", text: "#721c24", border: "#f5c6cb", icon: "❌" },
    info: { bg: "#d1ecf1", text: "#0c5460", border: "#bee5eb", icon: "ℹ️" },
    warning: { bg: "#fff3cd", text: "#856404", border: "#ffeeba", icon: "⚠️" },
  };

  const color = colors[type];

  return (
    <div
      className="alert"
      style={{
        padding: "var(--spacing-md) var(--spacing-lg)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--spacing-md)",
        fontSize: "var(--font-size-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--spacing-md)",
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
        <span style={{ fontSize: "20px" }}>{color.icon}</span>
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "var(--font-size-xl)",
            cursor: "pointer",
            color: color.text,
            padding: "0",
            minWidth: "24px",
            minHeight: "24px",
          }}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
}

