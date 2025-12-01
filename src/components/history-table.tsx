type HistoryRow = {
  id: string;
  month: Date;
  totalScore: number;
  parameterBreakdown: Record<string, { rawValue: number; weightedScore: number }>;
};

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Score History</h3>
          <p className="text-sm text-slate-400">Normalized results stored after each import.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-3">Month</th>
              <th className="pb-3">Score</th>
              <th className="pb-3">Top Drivers</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {rows.map((row) => {
              const topDrivers = Object.entries(row.parameterBreakdown)
                .sort(([, a], [, b]) => b.weightedScore - a.weightedScore)
                .slice(0, 3);
              return (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-3">
                    {new Date(row.month).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="py-3 font-semibold">{row.totalScore.toFixed(1)}</td>
                  <td className="py-3 text-xs">
                    <div className="flex gap-2">
                      {topDrivers.map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-100"
                        >
                          {key}: {value.weightedScore.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



