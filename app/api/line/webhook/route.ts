import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("LINE webhook body:", JSON.stringify(body, null, 2));

    const event = body?.events?.[0];
    const replyToken = event?.replyToken;
    const userMessage = event?.message?.text ?? "(textなし)";

    if (!replyToken) {
      console.log("replyTokenなし。イベント種別:", event?.type);
      return NextResponse.json({ ok: true });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.error("LINE_CHANNEL_ACCESS_TOKEN が未設定");
      return NextResponse.json({ ok: true });
    }

    const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: "text",
            text: `受け取ったよ👇\n${userMessage}`,
          },
        ],
      }),
    });

    const lineText = await lineRes.text();
    console.log("LINE reply status:", lineRes.status);
    console.log("LINE reply body:", lineText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
