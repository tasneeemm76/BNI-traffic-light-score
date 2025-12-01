"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type UploadPeriod = {
  id: string;
  label: string | null;
  chapter: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  status?: string;
  _count: {
    dataPoints: number;
  };
};

type UploadPeriodsListProps = {
  uploads: UploadPeriod[];
};

export function UploadPeriodsList({ uploads: initialUploads }: UploadPeriodsListProps) {
  const [uploads, setUploads] = useState(initialUploads);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync with new props when they change (e.g., after router.refresh())
  useEffect(() => {
    setUploads(initialUploads);
  }, [initialUploads]);

  const handleDelete = async (uploadId: string) => {
    if (!confirm("Are you sure you want to delete this upload and all its records? This action cannot be undone.")) {
      return;
    }

    setDeletingId(uploadId);
    setStatus(null);

    try {
      const response = await fetch(`/api/upload/delete?id=${uploadId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete upload");
      }

      // Remove the deleted upload from the list
      setUploads(uploads.filter((u) => u.id !== uploadId));
      setStatus({ type: "success", message: "Upload and all related records deleted successfully" });
      
      // Refresh the page after a short delay to update the list
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete upload",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <Card
        title="Previously Uploaded Periods"
        subtitle="Multiple months can be uploaded. Re-uploading the same period will replace existing records for that period."
      >
        {status && (
          <div style={{ marginBottom: "var(--spacing-md)" }}>
            <Alert
              type={status.type}
              message={status.message}
              onClose={() => setStatus(null)}
            />
          </div>
        )}
        <div className="table-container">
          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--font-size-base)",
              backgroundColor: "var(--bg-primary)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <thead
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <tr>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  Period
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  Label
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  Chapter
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Members
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  Uploaded
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Status
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, index) => {
                const periodStart = new Date(upload.periodStart);
                const periodEnd = new Date(upload.periodEnd);
                const createdAt = new Date(upload.createdAt);

                // Format dates consistently to avoid hydration mismatches
                const formatDate = (date: Date) => {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${month}/${day}/${year}`;
                };

                const formatDateTime = (date: Date) => {
                  const dateStr = formatDate(date);
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  return `${dateStr} ${hours}:${minutes}`;
                };

                return (
                  <tr
                    key={upload.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                    }}
                  >
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontWeight: "var(--font-weight-semibold)" }}>
                      {formatDate(periodStart)} – {formatDate(periodEnd)}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                      {upload.label || "—"}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                      {upload.chapter || "—"}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                      {upload._count.dataPoints}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                      {formatDateTime(createdAt)}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "var(--spacing-xs) var(--spacing-sm)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--font-size-sm)",
                          fontWeight: "var(--font-weight-medium)",
                          backgroundColor: upload.status === "PROCESSED" ? "#d4edda" : "#fff3cd",
                          color: upload.status === "PROCESSED" ? "#155724" : "#856404",
                        }}
                      >
                        {upload.status || "PROCESSED"}
                      </span>
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(upload.id)}
                        disabled={deletingId === upload.id}
                        className="btn"
                        style={{
                          backgroundColor: "var(--error)",
                          color: "white",
                          padding: "var(--spacing-sm) var(--spacing-md)",
                          fontSize: "var(--font-size-sm)",
                          minHeight: "36px",
                        }}
                        onMouseEnter={(e) => {
                          if (!deletingId) {
                            e.currentTarget.style.backgroundColor = "#cc0000";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!deletingId) {
                            e.currentTarget.style.backgroundColor = "var(--error)";
                          }
                        }}
                      >
                        {deletingId === upload.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
  );
}

