"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileUpload, FileUploadRef } from "@/components/ui/FileUpload";
import { Alert } from "@/components/ui/Alert";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/Card";

export function AdminUploadForm() {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string>("PATRONS");
  const [chapters, setChapters] = useState<string[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const mainFileRef = useRef<FileUploadRef>(null);
  const trainingFileRef = useRef<FileUploadRef>(null);

  // Fetch available chapters on component mount
  useEffect(() => {
    setIsLoadingChapters(true);
    fetch("/api/chapters")
      .then((res) => res.json())
      .then((data) => {
        if (data.chapters && Array.isArray(data.chapters)) {
          setChapters(data.chapters);
          // Set default to PATRONS if available
          if (data.chapters.includes("PATRONS")) {
            setSelectedChapter("PATRONS");
          } else if (data.chapters.length > 0) {
            setSelectedChapter(data.chapters[0]);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching chapters:", error);
        // Fallback to PATRONS if API fails
        setChapters(["PATRONS"]);
        setSelectedChapter("PATRONS");
      })
      .finally(() => {
        setIsLoadingChapters(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Get files from refs
    const mainFile = mainFileRef.current?.getFile();
    const trainingFile = trainingFileRef.current?.getFile();
    
    if (!mainFile) {
      setStatus({ type: "error", message: "Please attach the main performance report." });
      return;
    }
    
    formData.append('mainReport', mainFile);
    if (trainingFile) {
      formData.append('trainingReport', trainingFile);
    }
    if (selectedChapter && selectedChapter.trim() !== "") {
      formData.append('chapter', selectedChapter);
    }
    
    setIsUploading(true);
    setStatus({ type: "info", message: "Validating file..." });
    
    try {
      const response = await fetch("/api/upload_file", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let errorMessage = "Upload failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorData || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      
      setStatus({ 
        type: "success", 
        message: `Upload successful! Processed ${responseData.count || 0} members successfully. ${responseData.message || ""}` 
      });
      
      // Reset form
      const form = e.currentTarget;
      if (form) {
        form.reset();
      }
      mainFileRef.current?.clear();
      trainingFileRef.current?.clear();
      // Reset to default chapter (PATRONS) after successful upload
      if (chapters.length > 0 && chapters.includes("PATRONS")) {
        setSelectedChapter("PATRONS");
      } else if (chapters.length > 0) {
        setSelectedChapter(chapters[0]);
      } else {
        setSelectedChapter("PATRONS");
      }
      
      // Refresh the page to show updated uploads list
      // Small delay to ensure database transaction is fully committed
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setStatus({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to upload. Please try again." 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card
      title="Admin Bulk Upload"
      subtitle="Attach the official performance export plus the optional CEU/training sheet. The scoring engine normalizes fields, calculates weekly metrics, and persists the results for the analytics views."
    >
      <form onSubmit={handleSubmit}>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
            marginBottom: "var(--spacing-md)",
            padding: "var(--spacing-md)",
            backgroundColor: "var(--bg-tertiary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          Note: The report label will be automatically generated from the end date (e.g., "November 2025"). If you upload data for a period that already exists, the old records will be replaced with the new data.
        </p>

        <div style={{ marginBottom: "var(--spacing-md)" }}>
          <label
            htmlFor="chapter"
            style={{
              display: "block",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "var(--spacing-xs)",
            }}
          >
            Chapter
          </label>
          {isLoadingChapters ? (
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
              Loading chapters...
            </div>
          ) : (
            <select
              id="chapter"
              name="chapter"
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              disabled={isUploading}
              style={{
                width: "100%",
                padding: "var(--spacing-sm)",
                fontSize: "var(--font-size-sm)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: isUploading ? "not-allowed" : "pointer",
              }}
            >
              {chapters.length > 0 ? (
                chapters.map((chapter) => (
                  <option key={chapter} value={chapter}>
                    {chapter}
                  </option>
                ))
              ) : (
                <option value="PATRONS">PATRONS</option>
              )}
            </select>
          )}
        </div>

        <FileUpload
          ref={mainFileRef}
          label="Upload palm data"
          accept=".csv,.xlsx,.xls"
          onFileSelect={() => {}}
          required
          disabled={isUploading}
          name="mainReport"
        />

        <FileUpload
          ref={trainingFileRef}
          label="Upload training data (optional)"
          accept=".csv,.xlsx,.xls"
          onFileSelect={() => {}}
          disabled={isUploading}
          name="trainingReport"
        />

        <input type="hidden" name="source" value="ADMIN" />

        {isUploading ? (
          <LoadingSpinner size={40} message="Processing your file..." />
        ) : (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isUploading}
            style={{ width: "100%", marginTop: "var(--spacing-md)" }}
          >
            Upload Data
          </button>
        )}
      </form>

      {status && (
        <div style={{ marginTop: "var(--spacing-lg)" }}>
          <Alert
            type={status.type === "success" ? "success" : status.type === "error" ? "error" : "info"}
            message={status.message}
            onClose={() => setStatus(null)}
          />
        </div>
      )}
    </Card>
  );
}
