import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

// Color mapping function
function colorByTotalScore(totalScore: number): string {
  if (totalScore >= 70) return "#008000"; // Green
  if (totalScore >= 50) return "#FFBF00"; // Amber
  if (totalScore >= 30) return "#ff0000"; // Red
  return "#808080"; // Grey
}

export default async function HomePage() {
  // Get the most recent upload based on periodEnd date
  const latestUpload = await prisma.reportUpload.findFirst({
    where: {
      source: "ADMIN",
      status: "PROCESSED",
    },
    orderBy: { periodEnd: "desc" },
    include: {
      dataPoints: {
        include: { member: true },
        orderBy: { totalScore: "desc" },
      },
    },
  });

  const periodLabel = latestUpload?.label ?? 
    (latestUpload?.periodStart 
      ? latestUpload.periodStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : "No Data");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-secondary)" }}>
      {/* Sticky Navigation */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          backgroundColor: "var(--bg-primary)",
          borderBottom: "2px solid var(--border)",
          padding: "var(--spacing-md) var(--spacing-xl)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--spacing-lg)",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            BNI Scoring
          </Link>

          {/* Desktop Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-lg)",
            }}
            className="desktop-nav"
          >
            <Link
              href="/dashboard"
              style={{
                fontSize: "var(--font-size-base)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontWeight: "var(--font-weight-medium)",
                padding: "var(--spacing-sm) var(--spacing-md)",
                borderRadius: "var(--radius-md)",
                transition: "background-color var(--transition-base)",
              }}
            >
              Dashboard
            </Link>
            <Link
              href="/member-analysis"
              style={{
                fontSize: "var(--font-size-base)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontWeight: "var(--font-weight-medium)",
                padding: "var(--spacing-sm) var(--spacing-md)",
                borderRadius: "var(--radius-md)",
                transition: "background-color var(--transition-base)",
              }}
            >
              Members
            </Link>
            <Link
              href="/dashboard/admin/upload"
              className="btn btn-primary"
              style={{
                padding: "var(--spacing-md) var(--spacing-lg)",
                fontSize: "var(--font-size-base)",
                fontWeight: "var(--font-weight-semibold)",
              }}
            >
              Upload File
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          padding: "var(--spacing-3xl) var(--spacing-xl)",
          backgroundColor: "var(--bg-primary)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "var(--font-size-4xl)",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--text-primary)",
              marginBottom: "var(--spacing-lg)",
              lineHeight: "var(--line-height-tight)",
            }}
          >
            Grow Your BNI Chapter With Data
          </h1>
          <p
            style={{
              fontSize: "var(--font-size-xl)",
              color: "var(--text-secondary)",
              marginBottom: "var(--spacing-2xl)",
              maxWidth: "800px",
              margin: "0 auto var(--spacing-2xl)",
              lineHeight: "var(--line-height-relaxed)",
            }}
          >
            Visualize performance, track activities, empower referrals.
          </p>
        </div>
      </section>

      {/* Members Table Section */}
      <section
        style={{
          padding: "var(--spacing-3xl) var(--spacing-xl)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {!latestUpload || latestUpload.dataPoints.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
                <h2
                  style={{
                    fontSize: "var(--font-size-2xl)",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  No score data yet
                </h2>
                <p style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>
                  Upload the main performance and optional training reports to populate this table.
                </p>
              </div>
            </Card>
          ) : (
            <Card
              title={`Member Scores - ${periodLabel}`}
              subtitle={`${latestUpload.dataPoints.length} members • ${latestUpload.periodStart.toLocaleDateString()} – ${latestUpload.periodEnd.toLocaleDateString()}`}
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
                        Rank
                      </th>
                      <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                        Member
                      </th>
                      <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "left" }}>
                        Chapter
                      </th>
                      <th style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                        Total Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestUpload.dataPoints.map((row, index) => {
                      const rank = index + 1;
                      const scoreColor = colorByTotalScore(row.totalScore);
                      const colorMap: Record<string, string> = {
                        "#008000": "Green",
                        "#FFBF00": "Amber",
                        "#ff0000": "Red",
                        "#808080": "Grey",
                      };
                      const statusLabel = colorMap[scoreColor] || "Grey";
                      
                      return (
                        <tr
                          key={row.id}
                          style={{
                            backgroundColor: index % 2 === 0 ? "var(--bg-tertiary)" : "var(--bg-primary)",
                          }}
                        >
                          <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontWeight: "var(--font-weight-semibold)" }}>
                            {rank}
                          </td>
                          <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", fontWeight: "var(--font-weight-semibold)" }}>
                            {row.member.displayName}
                          </td>
                          <td style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                            {latestUpload.chapter ?? row.member.chapter ?? "—"}
                          </td>
                          <td style={{ padding: "var(--spacing-md) var(--spacing-lg)", textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "var(--spacing-sm) var(--spacing-md)",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: scoreColor,
                                color: "white",
                                fontWeight: "var(--font-weight-bold)",
                                fontSize: "var(--font-size-lg)",
                                minWidth: "60px",
                              }}
                            >
                              {Math.round(row.totalScore)}
                            </span>
                            <div
                              style={{
                                fontSize: "var(--font-size-sm)",
                                color: "var(--text-secondary)",
                                marginTop: "var(--spacing-xs)",
                                fontWeight: "var(--font-weight-medium)",
                              }}
                            >
                              {statusLabel}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: "var(--primary)",
          color: "white",
          padding: "var(--spacing-2xl) var(--spacing-xl)",
          marginTop: "var(--spacing-3xl)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--spacing-xl)",
              marginBottom: "var(--spacing-xl)",
            }}
          >
            <div>
              <h4
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                About
              </h4>
              <p
                style={{
                  fontSize: "var(--font-size-base)",
                  color: "rgba(255, 255, 255, 0.8)",
                  lineHeight: "var(--line-height-relaxed)",
                }}
              >
                BNI Scoring Platform helps chapters track performance, manage member data, and drive growth through data-driven insights.
              </p>
            </div>
            <div>
              <h4
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                Support
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-sm)",
                }}
              >
                <Link
                  href="/dashboard"
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    textDecoration: "none",
                    fontSize: "var(--font-size-base)",
                  }}
                >
                  Documentation
                </Link>
                <Link
                  href="/dashboard/admin/upload"
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    textDecoration: "none",
                    fontSize: "var(--font-size-base)",
                  }}
                >
                  Help Center
                </Link>
              </div>
            </div>
            <div>
              <h4
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                Contact
              </h4>
              <p
                style={{
                  fontSize: "var(--font-size-base)",
                  color: "rgba(255, 255, 255, 0.8)",
                }}
              >
                For support and inquiries, please contact your chapter administrator.
              </p>
            </div>
            <div>
              <h4
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                BNI Links
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-sm)",
                }}
              >
                <a
                  href="https://www.bni.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    textDecoration: "none",
                    fontSize: "var(--font-size-base)",
                  }}
                >
                  BNI Official Website
                </a>
                <a
                  href="https://www.bni.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    textDecoration: "none",
                    fontSize: "var(--font-size-base)",
                  }}
                >
                  BNI Resources
                </a>
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255, 255, 255, 0.2)",
              paddingTop: "var(--spacing-lg)",
              textAlign: "center",
              fontSize: "var(--font-size-sm)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            © 2025 BNI Scoring Platform. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
