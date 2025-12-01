// Suggestions generation - personalized and specific based on Python reference
type SuggestionInput = {
  total_score: number;
  referrals_week_score: number;
  visitors_week_score: number;
  absenteeism_score: number;
  training_score: number;
  testimonials_week_score: number;
  tyfcb_score: number;
  arriving_on_time_score: number;
  A: number; // Absent count
  CEU: number; // Training count
  TYFCB: number; // TYFCB value
  ref_per_week: number;
  visitors_per_week: number;
  testimonials_per_week: number;
  total_meetings: number;
  total_weeks?: number; // For calculating averages
};

export type Suggestion = {
  category: string;
  message: string;
  priority: "high" | "medium" | "low";
};

export function generateSuggestions(input: SuggestionInput): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Targets
  const REF_TARGET = 1.2;
  const VISITOR_TARGET = 0.75;
  const TESTIMONIAL_TARGET = 0.075;
  const TRAINING_TARGET = 3;
  const TYFCB_TARGET = 2000000;
  const FULL_SCORE = 100;
  const AVG_WEEKS = input.total_weeks || input.total_meetings || 12;

  const total_score = input.total_score || 0;
  const gap = FULL_SCORE - total_score;

  // Overall gap message
  if (gap > 0) {
    suggestions.push({
      category: "Overall",
      message: `You're at ${total_score}/100. Improve below areas to close the ${gap}-point gap and reach full 100.`,
      priority: gap > 30 ? "high" : gap > 15 ? "medium" : "low",
    });
  }

  // Referrals
  const ref_score = input.referrals_week_score;
  const ref_pw = input.ref_per_week || 0;
  if (ref_score < 20) {
    const needed = Math.max(0, REF_TARGET - ref_pw);
    const per_week_needed = Math.max(1, Math.round(needed));
    const total_needed = per_week_needed * AVG_WEEKS;
    suggestions.push({
      category: "Referrals",
      message: `Referrals: Give ${per_week_needed} more referral${per_week_needed > 1 ? "s" : ""} per week (${total_needed} total in ${AVG_WEEKS} weeks) to reach 20/20.`,
      priority: ref_score < 10 ? "high" : ref_score < 15 ? "medium" : "low",
    });
  }

  // Visitors - FINAL VISITOR LOGIC (CORRECT + FULLY PERSONALISED)
  const visitor_score = input.visitors_week_score;
  const visitor_pw = input.visitors_per_week || 0;
  const total_meetings = input.total_meetings || 1;
  if (visitor_score < 20) {
    const needed_per_week = VISITOR_TARGET - visitor_pw;
    if (needed_per_week > 0) {
      let total_visitors_needed = Math.round(needed_per_week * total_meetings);
      // minimum 1 ONLY if needed
      if (total_visitors_needed < 1) {
        total_visitors_needed = 1;
      }
      suggestions.push({
        category: "Visitors",
        message: `Visitors: Invite ${total_visitors_needed} more visitor${total_visitors_needed > 1 ? "s" : ""} to achieve full 20/20.`,
        priority: visitor_score < 10 ? "high" : visitor_score < 15 ? "medium" : "low",
      });
    }
  }

  // Absenteeism
  const abs_score = input.absenteeism_score;
  const absences = input.A || 0;
  if (abs_score < 15) {
    suggestions.push({
      category: "Attendance",
      message: `Attendance: You've missed ${absences} meeting${absences !== 1 ? "s" : ""}. Attend all remaining meetings for the next ${AVG_WEEKS} weeks to earn 15/15.`,
      priority: absences > 2 ? "high" : absences > 0 ? "medium" : "low",
    });
  }

  // Training
  const training_score = input.training_score;
  const ceu_count = input.CEU || 0;
  if (training_score < 15) {
    const needed = Math.max(0, TRAINING_TARGET - ceu_count);
    suggestions.push({
      category: "Training",
      message: `Training: Complete ${needed} more CEU session${needed !== 1 ? "s" : ""} to reach 15/15.`,
      priority: ceu_count === 0 ? "high" : ceu_count < 2 ? "medium" : "low",
    });
  }

  // Testimonials
  const testimonials_score = input.testimonials_week_score;
  const testimonials_pw = input.testimonials_per_week || 0;
  if (testimonials_score < 10) {
    const needed = Math.max(0, TESTIMONIAL_TARGET - testimonials_pw);
    const per_week_needed = Math.max(1, Math.round(needed));
    const total_needed = per_week_needed * AVG_WEEKS;
    suggestions.push({
      category: "Testimonials",
      message: `Testimonials: Give ${per_week_needed} more testimonial${per_week_needed > 1 ? "s" : ""} per week (${total_needed} total) to achieve 10/10.`,
      priority: testimonials_score < 5 ? "high" : "medium",
    });
  }

  // TYFCB
  const tyfcb_score = input.tyfcb_score;
  const tyfcb_value = input.TYFCB || 0;
  if (tyfcb_score < 15) {
    const needed = Math.max(0, TYFCB_TARGET - tyfcb_value);
    suggestions.push({
      category: "TYFCB",
      message: `TYFCB: Generate an additional ₹${needed.toLocaleString("en-IN")} in closed business to reach 15/15.`,
      priority: tyfcb_value < 500000 ? "high" : tyfcb_value < 1000000 ? "medium" : "low",
    });
  }

  // On Time
  if (input.arriving_on_time_score < 5) {
    suggestions.push({
      category: "On Time",
      message: "On Time: Arrive on time each week to secure all 5/5 points.",
      priority: "medium",
    });
  }

  return suggestions;
}

