import { PageLayout } from "@/components/layouts/PageLayout";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Get the most recent upload based on periodEnd date (most recent end date)
  // Only show data from ADMIN uploads that are PROCESSED
  const latestUpload = await prisma.reportUpload.findFirst({
    where: {
      source: "ADMIN",
      status: "PROCESSED",
    },
    orderBy: { periodEnd: "desc" }, // Order by end date to get most recent period
    include: {
      dataPoints: {
        include: { member: true },
        orderBy: { totalScore: "desc" }, // Order members by total score (highest first)
      },
    },
  });

  if (!latestUpload || latestUpload.dataPoints.length === 0) {
    return (
      <PageLayout
        title="Dashboard"
        subtitle="View ranked member scores and analytics"
      >
        <Card>
          <div style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
            <h2 style={{ fontSize: "var(--font-size-2xl)", marginBottom: "var(--spacing-md)" }}>
              No score data yet
            </h2>
            <p style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>
              Upload the main performance and optional training reports to populate this dashboard.
            </p>
          </div>
        </Card>
      </PageLayout>
    );
  }

  const periodLabel = latestUpload.label ?? 
    latestUpload.periodStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PageLayout
      title={periodLabel}
      subtitle={`${latestUpload.dataPoints.length} members scored • ${latestUpload.periodStart.toLocaleDateString()} – ${latestUpload.periodEnd.toLocaleDateString()}`}
    >
      {/* Metrics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--spacing-lg)",
          marginBottom: "var(--spacing-xl)",
        }}
      >
        <MetricCard
          title="Total Members"
          value={latestUpload.dataPoints.length}
          color="var(--primary)"
        />
        <MetricCard
          title="Average Score"
          value={(
            latestUpload.dataPoints.reduce((sum, dp) => sum + dp.totalScore, 0) /
            latestUpload.dataPoints.length
          ).toFixed(1)}
          color="var(--accent)"
        />
        <MetricCard
          title="Top Score"
          value={Math.round(latestUpload.dataPoints[0]?.totalScore || 0).toString()}
          color="var(--success)"
        />
      </div>

      {/* Leaderboard Section */}
      <Card
        title={`Top Performing Members of ${periodLabel}`}
        subtitle="Leaderboard of highest scoring members"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-md)",
          }}
        >
          {latestUpload.dataPoints.slice(0, 10).map((row, index) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;
            const colorMap: Record<string, string> = {
              "#008000": "var(--success)",
              "#FFBF00": "var(--warning)",
              "#ff0000": "var(--error)",
              "#808080": "var(--info)",
            };
            const statusColor = colorMap[row.colorBand] || "var(--info)";
            
            return (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-lg)",
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  backgroundColor: isTopThree ? "var(--bg-tertiary)" : index % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-primary)",
                  borderRadius: "var(--radius-md)",
                  border: isTopThree ? `2px solid ${statusColor}` : "1px solid var(--border-light)",
                }}
              >
                {/* Rank Badge */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: isTopThree ? statusColor : "var(--bg-tertiary)",
                    color: isTopThree ? "white" : "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isTopThree ? "var(--font-size-xl)" : "var(--font-size-lg)",
                    fontWeight: "var(--font-weight-bold)",
                    flexShrink: 0,
                    border: isTopThree ? "none" : "2px solid var(--border)",
                  }}
                >
                  {rank === 1 ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : rank === 2 ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : rank === 3 ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : (
                    rank
                  )}
                </div>

                {/* Member Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--font-size-lg)",
                      fontWeight: "var(--font-weight-semibold)",
                      color: "var(--text-primary)",
                      marginBottom: "var(--spacing-xs)",
                    }}
                  >
                    {row.member.displayName}
                  </div>
                  {row.member.chapter && (
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {row.member.chapter}
                    </div>
                  )}
                </div>

                {/* Score */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--font-size-2xl)",
                      fontWeight: "var(--font-weight-bold)",
                      color: statusColor,
                      marginBottom: "var(--spacing-xs)",
                    }}
                  >
                    {Math.round(row.totalScore)}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--text-secondary)",
                      fontWeight: "var(--font-weight-medium)",
                    }}
                  >
                    {row.colorBand === "#008000" && "Green"}
                    {row.colorBand === "#FFBF00" && "Amber"}
                    {row.colorBand === "#ff0000" && "Red"}
                    {row.colorBand === "#808080" && "Grey"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Performers Table */}
      <Card
        title="All Members Performance"
        subtitle="Complete list sorted by score (Color bands follow 70/50/30 thresholds)"
      >
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
                  Member
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  Chapter
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Score
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {latestUpload.dataPoints.map((row, index) => {
                const colorMap: Record<string, { label: string; emoji: string }> = {
                  "#008000": { label: "Green", emoji: "🟢" },
                  "#FFBF00": { label: "Amber", emoji: "🟡" },
                  "#ff0000": { label: "Red", emoji: "🔴" },
                  "#808080": { label: "Grey", emoji: "⚪" },
                };
                const status = colorMap[row.colorBand] || { label: row.colorBand, emoji: "" };
                
                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                    }}
                  >
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontWeight: "var(--font-weight-semibold)" }}>
                      {row.member.displayName}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                      {row.member.chapter ?? "—"}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-bold)" }}>
                      {Math.round(row.totalScore)}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-medium)" }}>
                      {status.emoji} {status.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PageLayout>
  );
}
