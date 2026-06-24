/**
 * Server helpers for the Training → Practice "Job Review" (every-four-weeks
 * milestone). Pulls the required-task breakdown for a review's day span and
 * loads an owned game + review together. Kept out of lib/simulation.ts so these
 * Supabase-bound helpers stay separate from the Gemini AI engine.
 */

import { getSupabase } from "@/lib/supabase";
import type { RequiredAction, SimRole } from "@/lib/simulation";

type Supa = ReturnType<typeof getSupabase>;

/** 5 working days per week → week number a 1-indexed working day falls in. */
export function weekOf(day: number): number {
  return Math.max(1, Math.ceil(day / 5));
}

export type ReviewCompletedTask = {
  required_action_id: string;
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  description: string;
  points: number;
  score: number;
  max_score: number;
  feedback: string;
  auto_completed: boolean;
};

export type ReviewMissedTask = {
  required_action_id: string;
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  description: string;
  points: number;
};

export type ReviewProactiveTask = {
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  score: number;
  max_score: number;
  feedback: string;
};

export type ReviewTasks = {
  completed: ReviewCompletedTask[];
  missed: ReviewMissedTask[];
  proactive: ReviewProactiveTask[];
  earned: number;
  possible: number;
};

type ActionRow = {
  day_number: number;
  required_action_id: string | null;
  action_type: string;
  title: string;
  score: number;
  max_score: number;
  feedback: string;
  auto_completed: boolean;
};

/**
 * Build the per-required-task breakdown over an inclusive day span: which were
 * completed (with their graded score + feedback), which were missed, plus any
 * proactive actions taken, and the period's earned/possible points.
 */
export async function loadReviewTasks(
  supabase: Supa,
  gameId: string,
  fromDay: number,
  toDay: number,
): Promise<ReviewTasks> {
  const [{ data: days }, { data: actions }] = await Promise.all([
    supabase
      .from("simulation_days")
      .select("day_number, required_actions")
      .eq("game_id", gameId)
      .gte("day_number", fromDay)
      .lte("day_number", toDay)
      .order("day_number", { ascending: true }),
    supabase
      .from("simulation_actions")
      .select("day_number, required_action_id, action_type, title, score, max_score, feedback, auto_completed")
      .eq("game_id", gameId)
      .gte("day_number", fromDay)
      .lte("day_number", toDay),
  ]);

  const acts = (actions ?? []) as ActionRow[];
  const byReqId = new Map<string, ActionRow>();
  const proactive: ReviewProactiveTask[] = [];
  let earned = 0;
  let possible = 0;

  for (const a of acts) {
    earned += Number(a.score) || 0;
    if (a.required_action_id) {
      byReqId.set(a.required_action_id, a);
    } else {
      possible += Number(a.max_score) || 0;
      proactive.push({
        day_number: a.day_number,
        week: weekOf(a.day_number),
        action_type: a.action_type,
        title: a.title,
        score: Number(a.score) || 0,
        max_score: Number(a.max_score) || 0,
        feedback: a.feedback || "",
      });
    }
  }

  const completed: ReviewCompletedTask[] = [];
  const missed: ReviewMissedTask[] = [];

  for (const d of days ?? []) {
    const dayNumber = d.day_number as number;
    const week = weekOf(dayNumber);
    const reqs = (Array.isArray(d.required_actions) ? d.required_actions : []) as RequiredAction[];
    for (const r of reqs) {
      possible += Number(r.points) || 0;
      const act = byReqId.get(r.id);
      if (act) {
        completed.push({
          required_action_id: r.id,
          day_number: dayNumber,
          week,
          action_type: r.action_type,
          title: r.title,
          description: r.description,
          points: Number(r.points) || 0,
          score: Number(act.score) || 0,
          max_score: Number(act.max_score) || Number(r.points) || 0,
          feedback: act.feedback || "",
          auto_completed: Boolean(act.auto_completed),
        });
      } else {
        missed.push({
          required_action_id: r.id,
          day_number: dayNumber,
          week,
          action_type: r.action_type,
          title: r.title,
          description: r.description,
          points: Number(r.points) || 0,
        });
      }
    }
  }

  return {
    completed,
    missed,
    proactive,
    earned: Math.round(earned * 10) / 10,
    possible,
  };
}

export type OwnedGameRow = {
  id: string;
  user_id: string;
  role: SimRole;
  project_type: string;
  project_name: string;
  project_overview: string;
  location: string;
  contract_value: number;
  total_days: number;
  current_day: number;
  status: string;
};

export type JobReviewRow = {
  id: string;
  game_id: string;
  review_number: number;
  from_day: number;
  to_day: number;
  from_week: number;
  to_week: number;
  is_final: boolean;
  status: string;
  generated: boolean;
  score: number;
  max_score: number;
  grade: string;
  review: string;
  highlights: { kind: string; text: string }[];
  resolutions: { required_action_id: string; action_type: string; title: string; resolution: string }[];
  completed_count: number;
  missed_count: number;
  catch_up_count: number;
  created_at: string;
  generated_at: string | null;
  acknowledged_at: string | null;
};

/** Load a job review and its parent game, scoped to the owning user. */
export async function loadOwnedGameAndReview(
  supabase: Supa,
  gameId: string,
  reviewId: string,
  userId: string,
): Promise<{ game: OwnedGameRow; review: JobReviewRow } | null> {
  const { data: game } = (await supabase
    .from("simulation_games")
    .select(
      "id, user_id, role, project_type, project_name, project_overview, location, contract_value, total_days, current_day, status",
    )
    .eq("id", gameId)
    .eq("user_id", userId)
    .single()) as { data: OwnedGameRow | null };
  if (!game) return null;

  const { data: review } = (await supabase
    .from("simulation_job_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("game_id", gameId)
    .single()) as { data: JobReviewRow | null };
  if (!review) return null;

  return { game, review };
}

/** GameContext shape the AI engine expects, pulled from a loaded game row. */
export function toGameContext(game: OwnedGameRow) {
  return {
    role: game.role,
    project_type: game.project_type,
    project_name: game.project_name,
    project_overview: game.project_overview,
    location: game.location,
    contract_value: game.contract_value,
    total_days: game.total_days,
  };
}
