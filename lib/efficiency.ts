import type {
  Attendance,
  EfficiencyScore,
  Interaction,
  Task,
} from "@/lib/types";
import { interactionTypeDef } from "@/lib/config/stages";
import {
  PLANNED_MINUTES_PER_DAY,
  TARGET_INTERACTIONS_PER_FIELD_DAY,
  isScoredDay,
} from "@/lib/config/schedule";
import { clamp, pct } from "@/lib/utils";
import { fromDateKey } from "@/lib/dates";

/**
 * A member's week reduced to one number, 0–100.
 *
 * The weights are visible on purpose — the app always renders the breakdown
 * next to the score so nobody has to trust a black box. Adjust the weights
 * here and both the ring and the Tuesday decision panel follow.
 */
/**
 * Scoring is switched OFF.
 *
 * The weights below were guesses, and measuring people against a guess is
 * worse than not measuring them. Hours are still recorded in full — only the
 * 0–100 judgement is hidden, behind a "coming soon" placeholder, until the
 * team agrees what a good week actually looks like.
 *
 * Flip this to true to bring it back; nothing else needs changing.
 */
export const EFFICIENCY_ENABLED = false;

/**
 * The weekly timesheet is off too.
 *
 * It only ever existed to feed the score, and asking people to type start and
 * finish times for a number nobody is using is pure friction. What replaces it
 * is better anyway: every visit, call and message now carries the time it
 * happened, so the day reconstructs itself from real work instead of from two
 * numbers typed at the end of it.
 */
export const HOURS_ENABLED = false;

export const WEIGHTS = {
  /** Did you actually cover the 09:00–14:00 window on the three field days? */
  attendance: 30,
  /** Did you log real client work while you were out? */
  activity: 30,
  /** Did anything move forward as a result? */
  pipeline: 25,
  /** Did you do what you said you'd do, by when you said it? */
  tasks: 15,
} as const;

export const WEIGHT_LABELS: Record<keyof typeof WEIGHTS, string> = {
  attendance: "Attendance",
  activity: "Field activity",
  pipeline: "Pipeline movement",
  tasks: "Follow-through",
};

export const WEIGHT_LABELS_AR: Record<keyof typeof WEIGHTS, string> = {
  attendance: "الحضور",
  activity: "النشاط الميداني",
  pipeline: "تقدّم الصفقات",
  tasks: "الالتزام بالمهام",
};

interface ScoreInput {
  attendance: Attendance[];
  interactions: Interaction[];
  tasks: Task[];
  /** Stage advances recorded in this range. */
  stageAdvances: number;
  proposalsSent: number;
}

export function computeEfficiency({
  attendance,
  interactions,
  tasks,
  stageAdvances,
  proposalsSent,
}: ScoreInput): EfficiencyScore {
  /* --- Attendance: minutes covered inside the planned window --------- */
  const scoredDays = attendance.filter(
    (a) => a.status !== "off" && a.status !== "approved_off",
  );
  const minutesPlanned = scoredDays.length * PLANNED_MINUTES_PER_DAY;
  const minutesWorked = scoredDays.reduce((sum, a) => sum + a.minutesWorked, 0);
  const attendanceRatio = minutesPlanned
    ? clamp(minutesWorked / minutesPlanned, 0, 1)
    : 0;

  /* --- Activity: real client contact on the days that count ---------- */
  const fieldInteractions = interactions.filter((i) => {
    if (!interactionTypeDef(i.type).countsAsFieldWork) return false;
    return isScoredDay(new Date(i.happenedAt).getDay());
  }).length;
  const fieldDayCount = scoredDays.length || 1;
  const fieldTarget = fieldDayCount * TARGET_INTERACTIONS_PER_FIELD_DAY;
  const activityRatio = clamp(fieldInteractions / fieldTarget, 0, 1);

  /* --- Pipeline: did anything actually move? ------------------------- */
  // Two advances or proposals in a week is a solid week for a 3-person team.
  const pipelineTarget = 2;
  const pipelineRatio = clamp(
    (stageAdvances + proposalsSent) / pipelineTarget,
    0,
    1,
  );

  /* --- Tasks: done, and done on time -------------------------------- */
  const dueTasks = tasks.filter((t) => t.dueAt);
  const doneTasks = dueTasks.filter((t) => t.status === "done");
  const lateTasks = doneTasks.filter(
    (t) => t.completedAt && t.dueAt && new Date(t.completedAt) > new Date(t.dueAt),
  );
  const taskRatio = dueTasks.length
    ? clamp((doneTasks.length - lateTasks.length * 0.5) / dueTasks.length, 0, 1)
    : // No tasks due is neutral, not a failure — you get the benefit of the doubt.
      0.8;

  const breakdown = {
    attendance: Math.round(attendanceRatio * WEIGHTS.attendance),
    activity: Math.round(activityRatio * WEIGHTS.activity),
    pipeline: Math.round(pipelineRatio * WEIGHTS.pipeline),
    tasks: Math.round(taskRatio * WEIGHTS.tasks),
  };

  return {
    total: clamp(
      breakdown.attendance + breakdown.activity + breakdown.pipeline + breakdown.tasks,
      0,
      100,
    ),
    breakdown,
    detail: {
      minutesWorked,
      minutesPlanned,
      fieldInteractions,
      fieldTarget,
      stageAdvances,
      proposalsSent,
      tasksDone: doneTasks.length,
      tasksDueInRange: dueTasks.length,
      tasksLate: lateTasks.length,
    },
  };
}

export function scoreBand(total: number): {
  label: string;
  labelAr: string;
  color: string;
} {
  if (total >= 80)
    return { label: "Strong", labelAr: "ممتاز", color: "var(--success)" };
  if (total >= 60)
    return { label: "On track", labelAr: "جيد", color: "var(--accent)" };
  if (total >= 40)
    return { label: "Slipping", labelAr: "متذبذب", color: "var(--warn)" };
  return { label: "Behind", labelAr: "متأخر", color: "var(--critical)" };
}

/**
 * The recommendation shown next to each member in the Tuesday review panel.
 * It is advice, not an automatic decision — a human still flips the switch.
 */
export function wedThuRecommendation(total: number): {
  suggest: "on" | "off";
  reason: string;
} {
  if (total >= 75)
    return {
      suggest: "off",
      reason: "Hit the week's targets in three days — Wed/Thu can be off.",
    };
  if (total >= 55)
    return {
      suggest: "on",
      reason: "Close, but not there. One more field day would close the gap.",
    };
  return {
    suggest: "on",
    reason: "Well short of target — Wed and Thu should both be working days.",
  };
}

/** Percentage helpers used by the breakdown bars. */
export function breakdownBars(score: EfficiencyScore) {
  return (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((key) => ({
    key,
    label: WEIGHT_LABELS[key],
    labelAr: WEIGHT_LABELS_AR[key],
    earned: score.breakdown[key],
    max: WEIGHTS[key],
    percent: pct(score.breakdown[key], WEIGHTS[key]),
  }));
}

/** Only count attendance rows that fall on days we actually score. */
export function isScoredAttendance(a: Attendance): boolean {
  return isScoredDay(fromDateKey(a.date).getDay());
}
