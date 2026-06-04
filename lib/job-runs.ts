import { supabaseAdmin } from "@/lib/supabase";

export type JobTriggerType = "manual" | "automatic";

export function summarizeJob(title: string, payload: any) {
  const data = payload?.data ?? payload ?? {};
  if (!payload?.ok && payload?.error) return `${title}: error - ${payload.error}`;
  const parts = [`${title}: ejecutado`];
  if (typeof data.matches === "number") parts.push(`${data.matches} partidos detectados`);
  if (typeof data.locked === "number") parts.push(`${data.locked} partidos cerrados`);
  if (typeof data.sent === "number") parts.push(`${data.sent} mensajes enviados`);
  if (typeof data.notifications === "number") parts.push(`${data.notifications} avisos enviados`);
  if (typeof data.updated === "number") parts.push(`${data.updated} actualizados`);
  if (typeof data.inserted === "number") parts.push(`${data.inserted} creados`);
  if (typeof data.failures?.length === "number" && data.failures.length) parts.push(`${data.failures.length} fallos`);
  if (data.skipped) parts.push(`omitido: ${data.reason ?? "sin cambios"}`);
  return parts.join(" · ");
}

export async function recordJobRun(input: {
  jobPath: string;
  triggerType: JobTriggerType;
  ok: boolean;
  statusCode?: number;
  summary?: string;
  payload?: unknown;
}) {
  try {
    const db = supabaseAdmin();
    await db.from("job_runs").insert({
      job_path: input.jobPath,
      trigger_type: input.triggerType,
      ok: input.ok,
      status_code: input.statusCode ?? null,
      summary: input.summary ?? null,
      payload: input.payload ?? {}
    });
  } catch (error) {
    console.warn("[job-runs] could not record job", error);
  }
}
