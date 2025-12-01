"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";

type FileUploadProps = {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  required?: boolean;
  disabled?: boolean;
  name?: string;
};

export type FileUploadRef = {
  getFile: () => File | null;
  clear: () => void;
};

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(
  ({ label, accept = ".xlsx,.xls,.csv", onFileSelect, required, disabled, name }, ref) => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      getFile: () => file,
      clear: () => {
        setFile(null);
        setFileName(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
    }));

    const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        setFile(droppedFile);
        setFileName(droppedFile.name);
        onFileSelect(droppedFile);
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        onFileSelect(selectedFile);
      } else {
        setFile(null);
        setFileName(null);
      }
    };

    const handleClick = () => {
      fileInputRef.current?.click();
    };

      return (
        <div className="form-group">
          <label className="form-label">
            {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
          </label>
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? "var(--primary)" : "var(--border)"}`,
              borderRadius: "var(--radius-md)",
              padding: "var(--spacing-xl)",
              textAlign: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              backgroundColor: isDragging ? "var(--bg-tertiary)" : "var(--bg-primary)",
              transition: "all var(--transition-base)",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              name={name}
              accept={accept}
              onChange={handleFileChange}
              required={required}
              disabled={disabled}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "32px", marginBottom: "var(--spacing-md)" }}>📁</div>
            {fileName ? (
              <div>
                <div
                  style={{
                    fontSize: "var(--font-size-base)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--text-primary)",
                    marginBottom: "var(--spacing-xs)",
                  }}
                >
                  {fileName}
                </div>
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Click to change file
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: "var(--font-size-base)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--text-primary)",
                    marginBottom: "var(--spacing-sm)",
                  }}
                >
                  Drag & drop file here or click to browse
                </div>
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Accepted formats: {accept}
                </div>
              </div>
            )}
          </div>
        </div>
      );
  }
);

FileUpload.displayName = "FileUpload";

