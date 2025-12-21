import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { line, theme } = await req.json();

    if (!line || typeof line !== "string") {
      return NextResponse.json({ error: "Missing line" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const prompt = `
You are a songwriting assistant.
Theme: ${theme || "lofi heartbreak"}

Rewrite this lyric line into 3 different options.
Rules:
- Keep it ONE line each
- Max 12 words each
- Improve vibe and rhythm
- Keep meaning similar
Return ONLY a JSON array of strings.

Line: ${line}
`.trim();

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt }, { status: 500 });
    }

    const data = await res.json();
    const text = data?.output?.[0]?.content?.[0]?.text ?? "[]";

    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(text);
    } catch {
      suggestions = String(text)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
