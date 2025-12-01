"use client";

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";

type Props = {
  data: {
    month: string;
    totalScore: number;
    chapterAverage?: number;
  }[];
};

export function TrendChart({ data }: Props) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">6-Month Trend</h3>
          <p className="text-sm text-slate-400">Compare member score vs chapter average.</p>
        </div>
      </div>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <Line type="monotone" dataKey="totalScore" stroke="#34d399" strokeWidth={3} dot />
            <Line
              type="monotone"
              dataKey="chapterAverage"
              stroke="#818cf8"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
            />
            <ReferenceLine
              y={data.reduce((acc, point) => acc + point.totalScore, 0) / (data.length || 1)}
              stroke="#334155"
              strokeDasharray="2 6"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}



