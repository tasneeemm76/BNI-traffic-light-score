"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Alert } from "@/components/ui/Alert";

type MemberRecord = {
  period: string;
  date: string;
  total: number;
  color: string;
  absent: { value: number };
  referrals: { value: number };
  tyfcb: { value: number };
  visitors: { value: number };
  testimonials: { value: number };
  on_time: { value: number };
  training: { value: number };
};

type Suggestion = {
  category: string;
  message: string;
  priority: "high" | "medium" | "low";
};

function MemberAnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [members, setMembers] = useState<[string, MemberRecord[]][]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (member: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = member
        ? `/api/member-analysis?member=${encodeURIComponent(member)}`
        : "/api/member-analysis";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setMemberNames([]);
        setMembers([]);
        setSuggestions([]);
      } else {
        setMemberNames(data.memberNames || []);
        setSelectedMember(data.selectedMember);
        setMembers(data.members || []);
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      setError("Failed to load member analysis data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const member = searchParams.get("member");
    fetchData(member || null);
  }, [searchParams, fetchData]);

  const handleMemberChange = (memberName: string) => {
    if (memberName) {
      router.push(`/member-analysis?member=${encodeURIComponent(memberName)}`);
    } else {
      router.push("/member-analysis");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "var(--error)";
      case "medium":
        return "var(--warning)";
      case "low":
        return "var(--success)";
      default:
        return "var(--info)";
    }
  };

  return (
    <PageLayout
      title="Member-Wise Analysis"
      subtitle="View detailed performance history and get personalized suggestions for each member"
    >
      {loading ? (
        <LoadingSpinner size={60} message="Loading member analysis..." />
      ) : error ? (
        <Alert type="error" message={error} />
      ) : (
        <>
          {/* Member Selector */}
          <Card>
            <div className="form-group">
              <label className="form-label">Select Member</label>
              <select
                value={selectedMember || ""}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="form-select"
                style={{ fontSize: "var(--font-size-base)", minHeight: "44px" }}
              >
                <option value="">-- Select a member --</option>
                {memberNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Member Details */}
          {members.length > 0 && (
            <div>
              {members.map(([memberName, records]) => (
                <Card key={memberName} title={memberName}>
                  <DataTable
                    data={records}
                    columns={[
                      {
                        key: "period",
                        label: "Period",
                        render: (value) => (
                          <span style={{ fontWeight: "var(--font-weight-semibold)" }}>{value}</span>
                        ),
                      },
                      {
                        key: "total",
                        label: "Total Score",
                        align: "center",
                        render: (value, row) => (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "var(--spacing-sm) var(--spacing-md)",
                              borderRadius: "var(--radius-md)",
                              backgroundColor: row.color,
                              color: "white",
                              fontWeight: "var(--font-weight-bold)",
                              fontSize: "var(--font-size-lg)",
                              minWidth: "60px",
                            }}
                          >
                            {value}
                          </span>
                        ),
                      },
                      {
                        key: "training",
                        label: "Training",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "absent",
                        label: "Absent",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "referrals",
                        label: "Referrals",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "tyfcb",
                        label: "TYFCB",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "visitors",
                        label: "Visitors",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "testimonials",
                        label: "Testimonials",
                        align: "center",
                        render: (value) => value.value,
                      },
                      {
                        key: "on_time",
                        label: "On Time",
                        align: "center",
                        render: (value) => value.value,
                      },
                    ]}
                    striped
                    stickyHeader
                  />
                </Card>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <Card
              title="AI Suggestions & Recommendations"
              subtitle="Targeted actions to improve next month's score"
            >
              <div
                style={{
                  display: "grid",
                  gap: "var(--spacing-md)",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                }}
              >
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "var(--spacing-lg)",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${getPriorityColor(suggestion.priority)}`,
                      backgroundColor: `${getPriorityColor(suggestion.priority)}15`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "var(--spacing-sm)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--font-size-lg)",
                          fontWeight: "var(--font-weight-semibold)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {suggestion.category}
                      </span>
                      <span
                        style={{
                          padding: "var(--spacing-xs) var(--spacing-md)",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: getPriorityColor(suggestion.priority),
                          color: "white",
                          fontSize: "var(--font-size-sm)",
                          fontWeight: "var(--font-weight-semibold)",
                          textTransform: "uppercase",
                        }}
                      >
                        {suggestion.priority}
                      </span>
                    </div>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        margin: 0,
                        fontSize: "var(--font-size-base)",
                        lineHeight: "var(--line-height-relaxed)",
                      }}
                    >
                      {suggestion.message}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!selectedMember && memberNames.length > 0 && (
            <Card>
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-base)",
                }}
              >
                Select a member from the dropdown above to view their detailed analysis and suggestions.
              </p>
            </Card>
          )}
        </>
      )}
    </PageLayout>
  );
}

export default function MemberAnalysisPage() {
  return (
    <Suspense fallback={<LoadingSpinner size={60} message="Loading member analysis..." />}>
      <MemberAnalysisContent />
    </Suspense>
  );
}
