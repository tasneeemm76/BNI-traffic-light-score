type RecommendationProps = {
  breakdown: Record<string, { rawValue: number; weightedScore: number }>;
};

const suggestions: Record<string, (raw: number) => string> = {
  attendance: (raw) =>
    raw >= 22 ? "Excellent attendance streak." : "Aim for 90% attendance to unlock higher multipliers.",
  visitors: (raw) =>
    raw >= 6
      ? "Keep nurturing visitor invite systems."
      : "Block 15 minutes weekly to send visitor invites and follow-ups.",
  oneToOnes: (raw) =>
    raw >= 12 ? "Strong on 1:1s—document success stories." : "Schedule two power one-to-ones per month.",
  referralsGiven: (raw) =>
    raw >= 20 ? "Referral engine is humming." : "Review contact spheres to uncover warm referrals.",
  businessReceived: (raw) =>
    raw >= 25000
      ? "Chapter sees your value—share testimonials."
      : "Ask satisfied clients for measurable outcomes to showcase.",
  educationCredits: (raw) =>
    raw >= 12 ? "Education goals met—mentor newer members." : "Enroll in next regional workshop for quick credits.",
};

export function Recommendations({ breakdown }: RecommendationProps) {
  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold">AI Nudges</h3>
      <p className="text-sm text-slate-400">Targeted actions to improve next month’s score.</p>
      <ul className="mt-4 space-y-3">
        {Object.entries(breakdown).map(([key, value]) => (
          <li key={key} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
            <p className="text-sm uppercase tracking-wide text-slate-400">{key}</p>
            <p className="font-medium text-white">{suggestions[key]?.(value.rawValue) ?? "Keep up the good work."}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}



