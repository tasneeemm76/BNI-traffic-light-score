import { PageLayout } from "@/components/layouts/PageLayout";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/Card";
import { generateSuggestions, getBestSuggestion } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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

  // Categorize members by color bands with correct thresholds
  // >=70 GREEN, >=50 and <70 AMBER, >=30 and <50 RED, <30 GREY
  const greenMembers = latestUpload.dataPoints.filter(dp => dp.totalScore >= 70);
  const amberMembers = latestUpload.dataPoints.filter(dp => dp.totalScore >= 50 && dp.totalScore < 70);
  const redMembers = latestUpload.dataPoints.filter(dp => dp.totalScore >= 30 && dp.totalScore < 50);
  const greyMembers = latestUpload.dataPoints.filter(dp => dp.totalScore < 30);

  // Calculate points needed to reach next band for each member
  // Correct thresholds: >=70 GREEN, >=50 and <70 AMBER, >=30 and <50 RED, <30 GREY
  const getNextBandThreshold = (currentScore: number): number => {
    if (currentScore < 30) return 30; // Grey -> Red
    if (currentScore < 50) return 50; // Red -> Amber
    if (currentScore < 70) return 70; // Amber -> Green
    return 100; // Green -> Perfect
  };

  const getBandName = (score: number): string => {
    if (score >= 70) return "Green";
    if (score >= 50 && score < 70) return "Amber";
    if (score >= 30 && score < 50) return "Red";
    return "Grey";
  };

  // Prepare data for "Fix Your Score" table
  const fixScoreData = latestUpload.dataPoints.map((dp) => {
    const currentScore = Math.round(dp.totalScore);
    const nextThreshold = getNextBandThreshold(currentScore);
    const pointsNeeded = Math.max(0, nextThreshold - currentScore);
    const currentBand = getBandName(currentScore);
    
    // Extract metrics from rawMetrics JSON
    const rawMetrics = dp.rawMetrics as any;
    let refScore = 0, visitorScore = 0, absScore = 0, trainingScore = 0;
    let testimonialScore = 0, tyfcbScore = 0, onTimeScore = 0;
    
    if (Array.isArray(rawMetrics)) {
      rawMetrics.forEach((metric: any) => {
        if (metric.key === "referrals") refScore = metric.score || 0;
        if (metric.key === "visitors") visitorScore = metric.score || 0;
        if (metric.key === "absenteeism") absScore = metric.score || 0;
        if (metric.key === "training") trainingScore = metric.score || 0;
        if (metric.key === "testimonials") testimonialScore = metric.score || 0;
        if (metric.key === "tyfcb") tyfcbScore = metric.score || 0;
        if (metric.key === "arrival") onTimeScore = metric.score || 0;
      });
    }

    // Get the best suggestion for fastest score improvement
    const bestSuggestionResult = getBestSuggestion({
      total_score: currentScore,
      referrals_week_score: refScore,
      visitors_week_score: visitorScore,
      absenteeism_score: absScore,
      training_score: trainingScore,
      testimonials_week_score: testimonialScore,
      tyfcb_score: tyfcbScore,
      arriving_on_time_score: onTimeScore,
      A: Math.round(dp.absenteeism * latestUpload.totalWeeks),
      CEU: dp.trainingCount,
      TYFCB: dp.tyfcb,
      ref_per_week: dp.referralsPerWeek,
      visitors_per_week: dp.visitorsPerWeek,
      testimonials_per_week: dp.testimonialsPerWeek,
      total_meetings: latestUpload.totalWeeks,
      total_weeks: latestUpload.totalWeeks,
    });

    // Format the suggestion text to be more specific and actionable
    let suggestionText: string;
    if (bestSuggestionResult) {
      const { suggestion, pointsGain } = bestSuggestionResult;
      // Extract the actionable part (remove category prefix if present)
      const message = suggestion.message;
      const actionablePart = message.includes(":") 
        ? message.split(":")[1].trim()
        : message;
      
      // Add points impact and make it more prominent
      const pointsText = pointsGain > 0 
        ? ` [Fastest path: +${pointsGain} points]`
        : "";
      
      // Make it more personalized and specific
      suggestionText = `${actionablePart}${pointsText}`;
    } else if (currentBand === "Green") {
      suggestionText = "Excellent! Maintain your current performance to stay in the Green band.";
    } else {
      suggestionText = `Focus on improving your ${currentBand.toLowerCase()} score. Review your metrics to identify quick wins.`;
    }

    return {
      memberName: dp.member.displayName,
      currentScore,
      pointsNeeded,
      suggestion: suggestionText,
      currentBand,
    };
  }).sort((a, b) => a.pointsNeeded - b.pointsNeeded); // Sort by points needed (most urgent first)

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

      {/* Member Score Bands Table */}
      <Card
        title="Member Score Bands"
        subtitle="Members categorized by performance bands (Green ≥70, Amber ≥50 and &lt;70, Red ≥30 and &lt;50, Grey &lt;30)"
      >
        <div 
          className="table-container"
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            className="table"
            style={{
              width: "100%",
              minWidth: "600px",
              borderCollapse: "collapse",
              fontSize: "var(--font-size-base)",
              backgroundColor: "var(--bg-primary)",
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
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", backgroundColor: "#008000" }}>
                  🟢 Green Members (≥70)
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", backgroundColor: "#FFBF00", color: "#000" }}>
                  🟡 Amber Members (≥50 &amp; &lt;70)
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", backgroundColor: "#ff0000" }}>
                  🔴 Red Members (≥30 &amp; &lt;50)
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", backgroundColor: "#808080" }}>
                  ⚪ Grey Members (&lt;30)
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(greenMembers.length, amberMembers.length, redMembers.length, greyMembers.length) }).map((_, index) => (
                <tr
                  key={index}
                  style={{
                    backgroundColor: index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                  }}
                >
                  <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                    {greenMembers[index] ? (
                      <div>
                        <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--spacing-xs)" }}>
                          {greenMembers[index].member.displayName}
                        </div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          Score: {Math.round(greenMembers[index].totalScore)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                    {amberMembers[index] ? (
                      <div>
                        <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--spacing-xs)" }}>
                          {amberMembers[index].member.displayName}
                        </div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          Score: {Math.round(amberMembers[index].totalScore)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                    {redMembers[index] ? (
                      <div>
                        <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--spacing-xs)" }}>
                          {redMembers[index].member.displayName}
                        </div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          Score: {Math.round(redMembers[index].totalScore)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                    {greyMembers[index] ? (
                      <div>
                        <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--spacing-xs)" }}>
                          {greyMembers[index].member.displayName}
                        </div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          Score: {Math.round(greyMembers[index].totalScore)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fix Your Score Table */}
      <Card
        title="Fix Your Score"
        subtitle="Personalized suggestions to help members reach the next performance band"
      >
        <div 
          className="table-container"
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            className="table"
            style={{
              width: "100%",
              minWidth: "700px",
              borderCollapse: "collapse",
              fontSize: "var(--font-size-base)",
              backgroundColor: "var(--bg-primary)",
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
                  Member Name
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Current Score
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                  Needed
                </th>
                <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                  How Will You Achieve It?
                </th>
              </tr>
            </thead>
            <tbody>
              {fixScoreData.map((member, index) => {
                const bandColor = member.currentBand === "Green" ? "#008000" :
                                 member.currentBand === "Amber" ? "#FFBF00" :
                                 member.currentBand === "Red" ? "#ff0000" : "#808080";
                
                return (
                  <tr
                    key={index}
                    style={{
                      backgroundColor: index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                    }}
                  >
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontWeight: "var(--font-weight-semibold)" }}>
                      {member.memberName}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "var(--spacing-xs) var(--spacing-md)",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: bandColor,
                          color: "white",
                          fontWeight: "var(--font-weight-bold)",
                          fontSize: "var(--font-size-lg)",
                        }}
                      >
                        {member.currentScore}
                      </span>
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                      {member.pointsNeeded > 0 ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "var(--spacing-xs) var(--spacing-md)",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--warning)",
                            color: "#000",
                            fontWeight: "var(--font-weight-semibold)",
                          }}
                        >
                          +{member.pointsNeeded}
                        </span>
                      ) : (
                        <span style={{ color: "var(--success)", fontWeight: "var(--font-weight-semibold)" }}>
                          ✓ Max
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-relaxed)" }}>
                      {member.suggestion}
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
