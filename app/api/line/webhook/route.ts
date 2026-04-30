import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function replyMessage(replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE reply error:", errText);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body?.events?.[0];
    const replyToken = event?.replyToken;
    const userId = event?.source?.userId;
    const userMessage = String(event?.message?.text || "").trim();

    if (!replyToken) {
      return NextResponse.json({ ok: true });
    }

if (!userMessage) {
  await replyMessage(
    replyToken,
    `あなたのLINE ID:\n${userId}`
  );

  return NextResponse.json({ ok: true });
}

    const { data, error } = await supabase
      .from("orders")
      .select("id,title,status,store_name,designer_name,contact_name")
      .eq("display_id", userMessage)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error.message);
      await replyMessage(replyToken, "検索中にエラーが発生しました。");
      return NextResponse.json({ ok: true });
    }

if (!data) {
  await replyMessage(
    replyToken,
    `あなたのLINE ID:\n${userId}`
  );

  return NextResponse.json({ ok: true });
}

    const text = [
      `案件名【 ${data.title || "未設定"}】`,
      `店舗名: ${data.store_name || "未設定"}`,
      `状態: ${data.status || "未設定"}`,
      `担当デザイナー: ${data.designer_name || "未設定"}`,
      `窓口担当者: ${data.contact_name || "未設定"}`,
      `詳細: https://app.1best.info/orders/${data.id}`,
    ].join("\n");

    await replyMessage(replyToken, text);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook route error:", e);
    return NextResponse.json({ ok: true });
  }
}
