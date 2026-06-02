import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const ChatBody = z.object({
  question: z.string().min(1).max(500)
});

function fallbackAnswer(question: string, context: unknown) {
  return `Todavía no hay OPENAI_API_KEY configurada. Pregunta recibida: "${question}". Contexto disponible: ${JSON.stringify(context).slice(0, 900)}`;
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question } = ChatBody.parse(await req.json());
  const db = supabaseAdmin();
  const [{ data: ranking }, { data: nextMatches }, { data: missing }] = await Promise.all([
    db.rpc("ranking"),
    db.from("matches").select("id, home_team, away_team, kickoff_at, stage, group_name").is("home_goals", null).order("kickoff_at").limit(10),
    db.rpc("pending_predictions_for_user", { p_user_id: user.id })
  ]);

  const context = { ranking, nextMatches, missing };
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: fallbackAnswer(question, context) });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Sos el asistente del prode Mundialito. Responde corto, claro y en espanol rioplatense. Usa solo los datos JSON provistos. Si falta un dato, decilo. No inventes."
      },
      { role: "user", content: JSON.stringify({ question, context }) }
    ]
  });

  return NextResponse.json({ answer: completion.choices[0]?.message?.content ?? "No pude responder." });
}
