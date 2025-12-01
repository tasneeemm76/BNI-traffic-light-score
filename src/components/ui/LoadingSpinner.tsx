"use client";

type LoadingSpinnerProps = {
  size?: number;
  message?: string;
};

export function LoadingSpinner({ size = 50, message }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--spacing-xl)",
      }}
    >
      <div
        className="loading-spinner"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: `${size / 8}px solid var(--border)`,
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      {message && (
        <p
          style={{
            marginTop: "var(--spacing-md)",
            fontSize: "var(--font-size-base)",
            color: "var(--text-secondary)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          {message}
        </p>
      )}
      <style jsx>{`
        @keyframes spin {
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

