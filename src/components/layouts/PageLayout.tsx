"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { useState, useEffect } from "react";

type PageLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showSidebar?: boolean;
  showTopBar?: boolean;
};

export function PageLayout({
  children,
  title,
  subtitle,
  showSidebar = true,
  showTopBar = true,
}: PageLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {/* Sidebar - Desktop */}
      {showSidebar && !isMobile && <Sidebar />}

      {/* Mobile Menu Button */}
      {showSidebar && isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: "fixed",
            top: "var(--spacing-md)",
            left: "var(--spacing-md)",
            zIndex: 1000,
            background: "var(--primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "var(--spacing-sm) var(--spacing-md)",
            fontSize: "var(--font-size-base)",
            cursor: "pointer",
            boxShadow: "var(--shadow-md)",
          }}
          aria-label="Toggle menu"
        >
          ☰ Menu
        </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {showSidebar && isMobile && sidebarOpen && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 998,
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "280px",
              height: "100vh",
              backgroundColor: "var(--bg-primary)",
              zIndex: 999,
              overflowY: "auto",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0, // Prevents overflow
        }}
      >
        {showTopBar && <TopBar title={title} subtitle={subtitle} />}
        <main
          style={{
            flex: 1,
            padding: isMobile ? "var(--spacing-md)" : "var(--spacing-xl)",
            maxWidth: "1400px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

