"use client";

import { useState } from "react";
import type { MemberScoreResult } from "@/lib/scoring";

export function UploadPreviewForm() {
  const [rows, setRows] = useState<MemberScoreResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    const mainReport = formData.get("mainReport");
    if (!(mainReport instanceof File)) {
      setError("Attach the main performance report.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/upload_file", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setRows(data.scores ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Instant Score Preview</h3>
        <p className="text-sm text-slate-400">
          Drag & drop any member data file (CSV / XLSX). We parse locally and return scores
          without persisting anything on the server.
        </p>
      </div>
      <form action={handleSubmit} className="rounded-xl border border-dashed border-slate-700 p-6">
        <label className="block text-sm text-slate-300">
          Upload palm data
          <input
            type="file"
            name="mainReport"
            accept=".csv,.xlsx"
            className="mt-1 w-full cursor-pointer text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500"
          />
        </label>
        <label className="mt-3 block text-sm text-slate-300">
          Upload training data
          <input
            type="file"
            name="trainingReport"
            accept=".csv,.xlsx"
            className="mt-1 w-full cursor-pointer text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500"
          />
        </label>
        <input type="hidden" name="source" value="USER_PREVIEW" />
        <button
          type="submit"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Calculating..." : "Calculate scores"}
        </button>
      </form>
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
      {rows.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Preview ({rows.length})
          </h4>
          <ul className="space-y-3">
            {rows.slice(0, 5).map((row) => (
              <li
                key={`${row.memberName}-${row.raw?.periodMonth ?? row.memberName}`}
                className="rounded-2xl border border-white/5 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{row.memberName}</p>
                    <p className="text-xs text-slate-400">
                      {row.chapter ?? "Unaffiliated"} •{" "}
                      {new Date(row.raw.periodMonth).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {row.totalScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  {row.metrics?.slice(0, 4).map((metric: MemberScoreResult["metrics"][number]) => (
                    <div key={metric.key} className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-2">
                      <p className="font-medium text-slate-200">{metric.label}</p>
                      <p>
                        {metric.value.toFixed(2)} / {metric.score} pts
                      </p>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {rows.length > 5 && (
            <p className="text-xs text-slate-400">
              Showing first 5 entries. Download full results after creating an account.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

