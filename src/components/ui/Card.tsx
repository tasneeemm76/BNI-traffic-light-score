"use client";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Card({ title, subtitle, children, className, style }: CardProps) {
  return (
    <div
      className={`card ${className || ""}`}
      style={{
        backgroundColor: "var(--bg-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--spacing-lg)",
        boxShadow: "var(--shadow-md)",
        marginBottom: "var(--spacing-lg)",
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div
          style={{
            borderBottom: "2px solid var(--border-light)",
            paddingBottom: "var(--spacing-md)",
            marginBottom: "var(--spacing-md)",
          }}
        >
          {title && (
            <h3
              style={{
                fontSize: "var(--font-size-xl)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--primary)",
                margin: 0,
                marginBottom: subtitle ? "var(--spacing-xs)" : 0,
              }}
            >
              {title}
            </h3>
          )}
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
      )}
      <div>{children}</div>
    </div>
  );
}

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: string;
};

export function MetricCard({ title, value, subtitle, color = "var(--primary)", icon }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--spacing-lg)",
        boxShadow: "var(--shadow-md)",
        textAlign: "center",
      }}
    >
      {icon && (
        <div style={{ fontSize: "32px", marginBottom: "var(--spacing-sm)" }}>{icon}</div>
      )}
      <div
        style={{
          fontSize: "var(--font-size-3xl)",
          fontWeight: "var(--font-weight-bold)",
          color: color,
          marginBottom: "var(--spacing-xs)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "var(--font-size-base)",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--text-primary)",
          marginBottom: subtitle ? "var(--spacing-xs)" : 0,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

