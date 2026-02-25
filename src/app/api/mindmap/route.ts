import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: { keyword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 },
    );
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    return NextResponse.json(
      { error: "keyword를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 마인드맵 도우미입니다. 사용자가 주는 키워드 하나에 대해 관련된 하위 주제나 개념을 5~8개 짧은 문장(한글, 항목당 10자 이내 권장)으로 나열합니다. 
응답은 반드시 JSON 배열 하나만 출력하세요. 예: ["항목1","항목2","항목3"] 
다른 설명 없이 오직 JSON 배열만 출력합니다.`,
        },
        {
          role: "user",
          content: `키워드: ${keyword}`,
        },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(raw) as unknown;
    const nodes = Array.isArray(parsed)
      ? parsed
          .filter((v): v is string => typeof v === "string")
          .map((s) => String(s).trim())
          .filter(Boolean)
      : [];

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error("OpenAI API error:", err);
    return NextResponse.json(
      { error: "AI 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
