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
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE reply error:", errText);
  }
}

async function getLineProfile(userId: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE profile error:", errText);
    return null;
  }

  return await res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body?.events?.[0];
    const eventType = event?.type;
    const replyToken = event?.replyToken;
    const userId = event?.source?.userId;
    const userMessage = String(event?.message?.text || "").trim();

   if (!replyToken) {
  return NextResponse.json({ ok: true });
}

// タブ切り替え時のpostbackを無視
if (eventType === "postback") {
  const data = event?.postback?.data;

  if (data === "switch-help" || data === "switch-main") {
    return NextResponse.json({ ok: true });
  }
}

if (eventType === "follow") {
  const profile = userId ? await getLineProfile(userId) : null;

  if (userId) {
    await supabase.from("line_users").upsert(
      {
        line_user_id: userId,
        line_name: profile?.displayName || null,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: "line_user_id",
      }
    );
  }

      await replyMessage(
        replyToken,
        "ご登録ありがとうございます！\n案件検索や進行確認が可能です。"
      );

      return NextResponse.json({ ok: true });
    }

    if (userMessage === "自分の案件") {
      const { data, error } = await supabase
        .from("orders")
        .select("id,display_id,title,status,store_name,designer_name,contact_name")
        .eq("line_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Supabase error:", error.message);
        await replyMessage(replyToken, "自分の案件の検索中にエラーが発生しました。");
        return NextResponse.json({ ok: true });
      }

      if (!data || data.length === 0) {
        await replyMessage(replyToken, "あなたに紐づいた案件はまだありません。");
        return NextResponse.json({ ok: true });
      }

      const text = data
        .map((order) =>
          [
            `${order.display_id}`,
            `案件名【 ${order.title || "未設定"}】`,
            `店舗名: ${order.store_name || "未設定"}`,
            `状態: ${order.status || "未設定"}`,
            `詳細: https://app.1best.info/orders/${order.id}`,
          ].join("\n")
        )
        .join("\n\n────────\n\n");

      await replyMessage(replyToken, text);
      return NextResponse.json({ ok: true });
    }


      if (userMessage === "お問い合わせ") {
        await replyMessage(
          replyToken,
          "お問い合わせありがとうございます。\n内容をそのままこのトークに送ってください。\n確認後、担当者より返信いたします。"
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
      await replyMessage(replyToken, "該当する案件が見つかりませんでした。");
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
