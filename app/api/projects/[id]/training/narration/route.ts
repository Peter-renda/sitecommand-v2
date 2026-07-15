/**
 * Coach narration for a "SiteCommand Training" sandbox.
 *
 * POST /api/projects/[id]/training/narration — body { day } → returns the coach
 * script for that in-sim day ({ title, text }) plus a signed URL to an MP3 of it
 * spoken by ElevenLabs ({ url, audio: true }). The audio is synthesized once and
 * cached in the project-drawings bucket (keyed by a hash of the script + voice +
 * model), so replays and re-opens are free and instant.
 *
 * When no ElevenLabs key is configured (or synthesis fails) the route still
 * returns the transcript with audio:false, so the coach degrades to a readable
 * message rather than failing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { buildTrainingNarration } from "@/lib/training-narration";
import { getTrainingSchedule, resolveDayIndex } from "@/lib/training-schedule";
import type { SimRole } from "@/lib/simulation-constants";

export const maxDuration = 60;

const STORAGE_BUCKET = "project-drawings";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// ElevenLabs prebuilt voice ("Adam" — a clear, steady narrator) + flagship model.
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

/** A non-blank, trimmed key — or undefined. Stops an empty/whitespace settings
 *  row from being treated as a real key (which would shadow the Vercel env key
 *  and either fail outright or silently disable audio). */
function cleanKey(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve the ElevenLabs key: company_integrations → platform_settings → the
 * Vercel/host env var (ELEVENLABS_API_KEY), mirroring the STT route. Blank DB
 * values are skipped so they never shadow the env key. `.maybeSingle()` (not
 * `.single()`) so a missing row is a clean "no value", not a logged error.
 */
async function resolveElevenLabsKey(companyId: string | null): Promise<string | undefined> {
  let apiKey: string | undefined;
  try {
    const supabase = getSupabase();
    if (companyId) {
      const { data } = await supabase
        .from("company_integrations")
        .select("value")
        .eq("company_id", companyId)
        .eq("key", "ELEVENLABS_API_KEY")
        .maybeSingle();
      apiKey = cleanKey(data?.value);
    }
    if (!apiKey) {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "ELEVENLABS_API_KEY")
        .maybeSingle();
      apiKey = cleanKey(data?.value);
    }
  } catch {
    // DB unavailable — fall through to env var.
  }
  return apiKey ?? cleanKey(process.env.ELEVENLABS_API_KEY);
}

/** Pull a concise human-readable message out of an ElevenLabs error body. The
 *  API returns shapes like {detail:{status,message}} or {detail:"..."}. */
function extractElevenLabsError(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      detail?: unknown;
      message?: unknown;
    };
    const detail = parsed.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const msg = (detail as { message?: unknown }).message;
      const status = (detail as { status?: unknown }).status;
      if (typeof msg === "string") return msg;
      if (typeof status === "string") return status;
    }
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Not JSON — return a trimmed snippet.
  }
  return raw.slice(0, 200) || null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { day?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawDay = Number(body.day);

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("is_training, training_role, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Not a training project" }, { status: 404 });
  }
  const role = (project.training_role ?? "") as SimRole;

  // Resolve the requested (possibly raw) day to the active scheduled day.
  const schedule = getTrainingSchedule(role);
  if (schedule.length === 0) {
    return NextResponse.json({ error: "No narration for this role" }, { status: 404 });
  }
  const idx = resolveDayIndex(schedule, Number.isFinite(rawDay) ? rawDay : 0);
  const scheduledDay = schedule[Math.max(0, idx)].day;

  // Resolve the trainee's first name for a personal greeting.
  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", session.id)
    .maybeSingle();
  const userName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "";

  const narration = buildTrainingNarration(role, scheduledDay, {
    userName,
    projectName: project.name,
  });
  if (!narration) {
    return NextResponse.json({ error: "No narration for this role" }, { status: 404 });
  }
  const { title, text } = narration;

  const apiKey = await resolveElevenLabsKey(session.company_id);
  if (!apiKey) {
    // No voice configured — still deliver the message as a readable transcript.
    return NextResponse.json({ title, text, audio: false, reason: "no_key", day: scheduledDay });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_MODEL_ID;

  // Cache key: re-synthesize only when the script, voice, or model changes.
  const hash = createHash("sha256")
    .update(`${text}|${voiceId}|${modelId}`)
    .digest("hex")
    .slice(0, 12);
  const storagePath = `${projectId}/_narration/pm-day-${scheduledDay}-${hash}.mp3`;

  // Return the cached audio if we've already synthesized this exact script.
  const { data: cached } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (cached?.signedUrl) {
    return NextResponse.json({ title, text, url: cached.signedUrl, audio: true, day: scheduledDay });
  }

  // Synthesize with ElevenLabs.
  try {
    const upstream = await fetch(
      `${ELEVENLABS_TTS_URL}/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
        }),
      },
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      const message = extractElevenLabsError(detail) || `ElevenLabs returned ${upstream.status}.`;
      console.error(`ElevenLabs TTS failed (${upstream.status}):`, detail.slice(0, 500));
      return NextResponse.json({
        title,
        text,
        audio: false,
        reason: "tts_failed",
        status: upstream.status,
        message,
        day: scheduledDay,
      });
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) {
      console.error("Failed to cache narration audio:", uploadError.message);
      return NextResponse.json({
        title,
        text,
        audio: false,
        reason: "upload_failed",
        message: uploadError.message,
        day: scheduledDay,
      });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ title, text, audio: false, reason: "sign_failed", day: scheduledDay });
    }

    return NextResponse.json({ title, text, url: signed.signedUrl, audio: true, day: scheduledDay });
  } catch (e) {
    console.error("Narration synthesis error:", e);
    return NextResponse.json({ title, text, audio: false, reason: "synthesis_error", day: scheduledDay });
  }
}
