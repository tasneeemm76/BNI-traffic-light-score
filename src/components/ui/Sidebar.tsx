"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/admin/upload", label: "Admin Upload", icon: "📤" },
  { href: "/member-analysis", label: "Member Analysis", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "280px",
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        borderRight: "2px solid var(--border)",
        padding: "var(--spacing-lg)",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
      }}
    >
      <div style={{ marginBottom: "var(--spacing-xl)" }}>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--primary)",
            margin: 0,
          }}
        >
          BNI Scoring
        </h2>
      </div>
      <nav>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} style={{ marginBottom: "var(--spacing-sm)" }}>
                <Link
                  href={item.href}
                  className="nav-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-md)",
                    padding: "var(--spacing-md) var(--spacing-lg)",
                    fontSize: "var(--font-size-base)",
                    color: isActive ? "white" : "var(--text-primary)",
                    backgroundColor: isActive ? "var(--primary)" : "transparent",
                    textDecoration: "none",
                    borderRadius: "var(--radius-md)",
                    transition: "all var(--transition-base)",
                    minHeight: "44px",
                    fontWeight: isActive ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

