"use client";

import { useState } from "react";

type DownloadReportButtonProps = {
  upload: {
    label?: string | null;
    chapter?: string | null;
    periodStart: Date | string;
    periodEnd: Date | string;
    dataPoints: Array<{
      id: string;
      member: {
        displayName: string;
        chapter?: string | null;
      };
      totalScore: number;
      colorBand: string;
    }>;
  };
};

export function DownloadReportButton({ upload }: DownloadReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Dynamically import the PDF generator to avoid SSR issues
      const { generatePDFReport } = await import("@/lib/pdf-generator");
      generatePDFReport(upload);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating || upload.dataPoints.length === 0}
      style={{
        padding: "var(--spacing-md) var(--spacing-lg)",
        fontSize: "var(--font-size-base)",
        fontWeight: "var(--font-weight-semibold)",
        backgroundColor: "var(--primary)",
        color: "white",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: isGenerating || upload.dataPoints.length === 0 ? "not-allowed" : "pointer",
        opacity: isGenerating || upload.dataPoints.length === 0 ? 0.6 : 1,
        transition: "opacity var(--transition-base)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-sm)",
      }}
      title={upload.dataPoints.length === 0 ? "No data available to download" : "Download PDF Report"}
    >
      {isGenerating ? (
        <>
          <span>Generating...</span>
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Download Report (PDF)</span>
        </>
      )}
    </button>
  );
}

