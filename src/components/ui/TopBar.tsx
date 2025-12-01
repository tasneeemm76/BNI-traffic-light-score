"use client";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header
      style={{
        backgroundColor: "var(--bg-primary)",
        borderBottom: "2px solid var(--border)",
        padding: "var(--spacing-lg) var(--spacing-xl)",
        marginBottom: "var(--spacing-xl)",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "var(--font-size-3xl)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--primary)",
            margin: 0,
            marginBottom: subtitle ? "var(--spacing-sm)" : 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "var(--font-size-base)",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}

