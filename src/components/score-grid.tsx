type ScoreGridProps = {
  totalScore: number;
  breakdown: Record<string, { rawValue: number; weightedScore: number }>;
};

export function ScoreGrid({ totalScore, breakdown }: ScoreGridProps) {
  const entries = Object.entries(breakdown);
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Composite Score</p>
          <p className="text-4xl font-semibold text-white">{totalScore.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Parameters</p>
          <p className="text-2xl font-bold text-emerald-400">{entries.length}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
            <p className="text-sm uppercase tracking-wide text-slate-400">{key}</p>
            <p className="text-xl font-semibold text-white">{value.weightedScore.toFixed(1)}</p>
            <p className="text-xs text-slate-400">Raw value {value.rawValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}



