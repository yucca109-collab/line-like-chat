import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "LINE token is missing" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const {
      lineUserId,
      displayId,
      title,
      storeName,
      contactName,
      orderUrl,
    } = body;

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const message = [
      "【案件受付完了】",
      "",
      `オーダーID：${displayId || "未採番"}`,
      `案件名：${title || "未入力"}`,
      `店舗名：${storeName || "未入力"}`,
      `担当者：${contactName || "未入力"}`,
      "",
      "案件を受け付けました。",
      "進行状況はこちらから確認できます。",
      orderUrl || "",
    ].join("\n");

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
