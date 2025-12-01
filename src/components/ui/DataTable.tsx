"use client";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  striped?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  striped = true,
  stickyHeader = true,
  onRowClick,
}: DataTableProps<T>) {
  return (
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
            position: stickyHeader ? "sticky" : "static",
            top: 0,
            zIndex: 10,
          }}
        >
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={{
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  textAlign: column.align || "left",
                  fontWeight: "var(--font-weight-semibold)",
                  fontSize: "var(--font-size-base)",
                  whiteSpace: "nowrap",
                  width: column.width,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "var(--spacing-xl)",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: striped && index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background-color var(--transition-fast)",
                }}
                onClick={() => onRowClick?.(row)}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = "#f0f0f0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor =
                      striped && index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)";
                  }
                }}
              >
                {columns.map((column) => {
                  const value = typeof column.key === "string" ? row[column.key] : row[column.key as keyof T];
                  return (
                    <td
                      key={String(column.key)}
                      style={{
                        padding: "var(--spacing-md) var(--spacing-lg)",
                        borderTop: "1px solid var(--border-light)",
                        textAlign: column.align || "left",
                      }}
                    >
                      {column.render ? column.render(value, row) : String(value ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

