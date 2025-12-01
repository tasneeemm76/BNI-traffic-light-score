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

  // Referrals - More specific and actionable
  const ref_score = input.referrals_week_score;
  const ref_pw = input.ref_per_week || 0;
  if (ref_score < 20) {
    // Calculate exact referrals needed to reach next tier
    let targetPerWeek = 0;
    let nextTier = "";
    if (ref_pw < 0.5) {
      targetPerWeek = 0.5;
      nextTier = "5 points (0.5 per week)";
    } else if (ref_pw < 0.75) {
      targetPerWeek = 0.75;
      nextTier = "10 points (0.75 per week)";
    } else if (ref_pw < 1) {
      targetPerWeek = 1;
      nextTier = "15 points (1 per week)";
    } else if (ref_pw < 1.2) {
      targetPerWeek = 1.2;
      nextTier = "20 points (1.2 per week)";
    }
    
    const needed = Math.max(0, targetPerWeek - ref_pw);
    const totalReferralsNeeded = Math.ceil(needed * AVG_WEEKS);
    
    if (totalReferralsNeeded > 0) {
      suggestions.push({
        category: "Referrals",
        message: `Give ${totalReferralsNeeded} more referral${totalReferralsNeeded > 1 ? "s" : ""} this period to reach ${nextTier}. Currently at ${ref_pw.toFixed(2)}/week (${ref_score}/20 points).`,
        priority: ref_score < 10 ? "high" : ref_score < 15 ? "medium" : "low",
      });
    }
  }

  // Visitors - More specific and actionable
  const visitor_score = input.visitors_week_score;
  const visitor_pw = input.visitors_per_week || 0;
  const total_meetings = input.total_meetings || 1;
  if (visitor_score < 20) {
    // Calculate exact visitors needed to reach next tier
    let targetPerWeek = 0;
    let nextTier = "";
    if (visitor_pw < 0.1) {
      targetPerWeek = 0.1;
      nextTier = "5 points (0.1 per week)";
    } else if (visitor_pw < 0.25) {
      targetPerWeek = 0.25;
      nextTier = "10 points (0.25 per week)";
    } else if (visitor_pw < 0.5) {
      targetPerWeek = 0.5;
      nextTier = "15 points (0.5 per week)";
    } else if (visitor_pw < 0.75) {
      targetPerWeek = 0.75;
      nextTier = "20 points (0.75 per week)";
    }
    
    const needed_per_week = targetPerWeek - visitor_pw;
    if (needed_per_week > 0) {
      let total_visitors_needed = Math.ceil(needed_per_week * total_meetings);
      if (total_visitors_needed < 1) total_visitors_needed = 1;
      
      suggestions.push({
        category: "Visitors",
        message: `Invite ${total_visitors_needed} more visitor${total_visitors_needed > 1 ? "s" : ""} this period to reach ${nextTier}. Currently at ${visitor_pw.toFixed(2)}/week (${visitor_score}/20 points).`,
        priority: visitor_score < 10 ? "high" : visitor_score < 15 ? "medium" : "low",
      });
    }
  }

  // Absenteeism - More specific
  const abs_score = input.absenteeism_score;
  const absences = input.A || 0;
  if (abs_score < 15) {
    let nextTier = "";
    let pointsGain = 0;
    if (absences > 2) {
      nextTier = "5 points (reduce to 2 absences)";
      pointsGain = 5;
    } else if (absences === 2) {
      nextTier = "10 points (reduce to 1 absence)";
      pointsGain = 5;
    } else if (absences === 1) {
      nextTier = "15 points (zero absences)";
      pointsGain = 5;
    }
    
    suggestions.push({
      category: "Attendance",
      message: `Attend all meetings. You've missed ${absences} meeting${absences !== 1 ? "s" : ""} (${abs_score}/15 points). Perfect attendance = ${nextTier}.`,
      priority: absences > 2 ? "high" : absences > 0 ? "medium" : "low",
    });
  }

  // Training - More specific
  const training_score = input.training_score;
  const ceu_count = input.CEU || 0;
  if (training_score < 15) {
    let needed = 0;
    let nextTier = "";
    if (ceu_count === 0) {
      needed = 1;
      nextTier = "5 points (1 CEU)";
    } else if (ceu_count === 1) {
      needed = 1;
      nextTier = "10 points (2 CEUs)";
    } else if (ceu_count === 2) {
      needed = 1;
      nextTier = "15 points (3+ CEUs)";
    }
    
    suggestions.push({
      category: "Training",
      message: `Complete ${needed} more CEU session${needed !== 1 ? "s" : ""} to reach ${nextTier}. Currently at ${ceu_count} CEU${ceu_count !== 1 ? "s" : ""} (${training_score}/15 points).`,
      priority: ceu_count === 0 ? "high" : ceu_count < 2 ? "medium" : "low",
    });
  }

  // Testimonials - More specific
  const testimonials_score = input.testimonials_week_score;
  const testimonials_pw = input.testimonials_per_week || 0;
  if (testimonials_score < 10) {
    let targetPerWeek = 0;
    let nextTier = "";
    if (testimonials_pw === 0) {
      targetPerWeek = 0.01; // Just need any testimonial
      nextTier = "5 points (any testimonial)";
    } else if (testimonials_pw < 0.075) {
      targetPerWeek = 0.075;
      nextTier = "10 points (0.075 per week)";
    }
    
    const needed = Math.max(0, targetPerWeek - testimonials_pw);
    const total_needed = Math.ceil(needed * AVG_WEEKS);
    
    if (total_needed > 0 || testimonials_pw === 0) {
      const actualNeeded = testimonials_pw === 0 ? 1 : Math.max(1, total_needed);
      suggestions.push({
        category: "Testimonials",
        message: `Give ${actualNeeded} more testimonial${actualNeeded > 1 ? "s" : ""} this period to reach ${nextTier}. Currently at ${testimonials_pw.toFixed(3)}/week (${testimonials_score}/10 points).`,
        priority: testimonials_score < 5 ? "high" : "medium",
      });
    }
  }

  // TYFCB - More specific
  const tyfcb_score = input.tyfcb_score;
  const tyfcb_value = input.TYFCB || 0;
  if (tyfcb_score < 15) {
    let target = 0;
    let nextTier = "";
    if (tyfcb_value < 500000) {
      target = 500000;
      nextTier = "5 points (₹5L)";
    } else if (tyfcb_value < 1000000) {
      target = 1000000;
      nextTier = "10 points (₹10L)";
    } else if (tyfcb_value < 2000000) {
      target = 2000000;
      nextTier = "15 points (₹20L)";
    }
    
    const needed = Math.max(0, target - tyfcb_value);
    if (needed > 0) {
      suggestions.push({
        category: "TYFCB",
        message: `Generate ₹${needed.toLocaleString("en-IN")} more in closed business to reach ${nextTier}. Currently at ₹${tyfcb_value.toLocaleString("en-IN")} (${tyfcb_score}/15 points).`,
        priority: tyfcb_value < 500000 ? "high" : tyfcb_value < 1000000 ? "medium" : "low",
      });
    }
  }

  // On Time - More specific
  if (input.arriving_on_time_score < 5) {
    suggestions.push({
      category: "On Time",
      message: `Arrive on time every week to earn 5/5 points. Currently at ${input.arriving_on_time_score}/5 points.`,
      priority: "medium",
    });
  }

  return suggestions;
}

// Scoring functions to calculate current and next tier points (matching scoring.ts logic)
const calculateReferralsScore = (refPerWeek: number): number => {
  if (refPerWeek >= 1.2) return 20;
  if (refPerWeek >= 1) return 15;
  if (refPerWeek >= 0.75) return 10;
  if (refPerWeek >= 0.5) return 5;
  return 0;
};

const calculateVisitorsScore = (visitorsPerWeek: number): number => {
  if (visitorsPerWeek >= 0.75) return 20;
  if (visitorsPerWeek >= 0.5) return 15;
  if (visitorsPerWeek >= 0.25) return 10;
  if (visitorsPerWeek >= 0.1) return 5;
  return 0;
};

const calculateAbsenteeismScore = (absentCount: number): number => {
  if (absentCount === 0) return 15;
  if (absentCount === 1) return 10;
  if (absentCount === 2) return 5;
  return 0;
};

const calculateTrainingScore = (ceuCount: number): number => {
  if (ceuCount > 2) return 15;
  if (ceuCount === 2) return 10;
  if (ceuCount === 1) return 5;
  return 0;
};

const calculateTestimonialsScore = (testimonialsPerWeek: number): number => {
  if (testimonialsPerWeek >= 0.075) return 10;
  if (testimonialsPerWeek > 0) return 5;
  return 0;
};

const calculateTYFCBScore = (tyfcb: number): number => {
  if (tyfcb >= 2000000) return 15;
  if (tyfcb >= 1000000) return 10;
  if (tyfcb >= 500000) return 5;
  return 0;
};

// Calculate what the next achievable score would be
const getNextAchievableScore = (category: string, input: SuggestionInput): number => {
  if (category === "Referrals") {
    const current = calculateReferralsScore(input.ref_per_week || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    if (current < 15) return 15;
    if (current < 20) return 20;
    return 20; // Already max
  } else if (category === "Visitors") {
    const current = calculateVisitorsScore(input.visitors_per_week || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    if (current < 15) return 15;
    if (current < 20) return 20;
    return 20;
  } else if (category === "Attendance") {
    const current = calculateAbsenteeismScore(input.A || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    if (current < 15) return 15;
    return 15;
  } else if (category === "Training") {
    const current = calculateTrainingScore(input.CEU || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    if (current < 15) return 15;
    return 15;
  } else if (category === "Testimonials") {
    const current = calculateTestimonialsScore(input.testimonials_per_week || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    return 10;
  } else if (category === "TYFCB") {
    const current = calculateTYFCBScore(input.TYFCB || 0);
    if (current < 5) return 5;
    if (current < 10) return 10;
    if (current < 15) return 15;
    return 15;
  } else if (category === "On Time") {
    return 5; // Can always get 5 if on time
  }
  return 0;
};

/**
 * Get the best suggestion for fastest score improvement
 * Analyzes all metrics and returns the one that gives the most points with least effort
 */
export function getBestSuggestion(input: SuggestionInput): { suggestion: Suggestion; pointsGain: number } | null {
  const allSuggestions = generateSuggestions(input);
  if (allSuggestions.length === 0) return null;

  // Calculate potential points gain for each suggestion using actual scoring logic
  const suggestionsWithPoints = allSuggestions
    .filter(s => s.category !== "Overall") // Filter out non-actionable
    .map(suggestion => {
      let currentScore = 0;
      let effort = "medium"; // low, medium, high

      // Get current score for this category
      if (suggestion.category === "Referrals") {
        currentScore = input.referrals_week_score;
        effort = currentScore < 10 ? "high" : currentScore < 15 ? "medium" : "low";
      } else if (suggestion.category === "Visitors") {
        currentScore = input.visitors_week_score;
        effort = currentScore < 10 ? "high" : currentScore < 15 ? "medium" : "low";
      } else if (suggestion.category === "Attendance") {
        currentScore = input.absenteeism_score;
        effort = (input.A || 0) > 2 ? "high" : (input.A || 0) > 0 ? "medium" : "low";
      } else if (suggestion.category === "Training") {
        currentScore = input.training_score;
        effort = (input.CEU || 0) === 0 ? "high" : (input.CEU || 0) < 2 ? "medium" : "low";
      } else if (suggestion.category === "Testimonials") {
        currentScore = input.testimonials_week_score;
        effort = currentScore < 5 ? "medium" : "low";
      } else if (suggestion.category === "TYFCB") {
        currentScore = input.tyfcb_score;
        effort = (input.TYFCB || 0) < 500000 ? "high" : (input.TYFCB || 0) < 1000000 ? "medium" : "low";
      } else if (suggestion.category === "On Time") {
        currentScore = input.arriving_on_time_score;
        effort = "low"; // Just need to be on time
      }

      // Calculate next achievable score
      const nextScore = getNextAchievableScore(suggestion.category, input);
      const potentialPoints = Math.max(0, nextScore - currentScore);

      return {
        suggestion,
        potentialPoints,
        currentScore,
        effort,
        priority: suggestion.priority,
      };
    })
    .filter(s => s.potentialPoints > 0); // Only include suggestions that can improve score

  if (suggestionsWithPoints.length === 0) return null;

  // Score each suggestion: prioritize high points, low effort, high priority
  const scoredSuggestions = suggestionsWithPoints.map(s => {
    let score = s.potentialPoints;
    // Bonus for low effort (easier to achieve)
    if (s.effort === "low") score += 5;
    else if (s.effort === "medium") score += 2;
    // Bonus for high priority (critical areas)
    if (s.priority === "high") score += 3;
    else if (s.priority === "medium") score += 1;
    
    return { ...s, score };
  });

  // Sort by score (highest first) and return the best one
  scoredSuggestions.sort((a, b) => b.score - a.score);
  const best = scoredSuggestions[0];
  
  return {
    suggestion: best.suggestion,
    pointsGain: best.potentialPoints,
  };
}

