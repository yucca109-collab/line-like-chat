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

async function upsertLineUser(userId?: string | null) {
  if (!userId) return;

  const profile = await getLineProfile(userId);

  const { error } = await supabase.from("line_users").upsert(
    {
      line_user_id: userId,
      line_name: profile?.displayName || null,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: "line_user_id",
    }
  );

  if (error) {
    console.error("line_users upsert error:", error.message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body?.events?.[0];
    const eventType = event?.type;
    const replyToken = event?.replyToken;
    const userId = event?.source?.userId;
    const userMessage = String(event?.message?.text || "").trim();

    await upsertLineUser(userId);

    if (eventType === "follow") {
      if (replyToken) {
        await replyMessage(
          replyToken,
          "ご登録ありがとうございます！\n案件検索や進行確認が可能です◎\n\n┏━━━━━━━━━━┓\n　🔑パスワードの付与\n┗━━━━━━━━━━┛\n\n下記メニューの\n\n「初回パスワード請求」をタップして\nパスワード送付までお待ちください🙇‍♀️"
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (!replyToken) {
      return NextResponse.json({ ok: true });
    }

    if (eventType === "postback") {
      return NextResponse.json({ ok: true });
    }

    if (eventType !== "message" || !userMessage) {
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
        "┏━━━━━━━━━━┓\n　💬 お問い合わせ受付\n┗━━━━━━━━━━┛\n\n内容をそのまま\nこのトークへ送信してください◎\n\n確認後、担当者より\n順次返信いたします。\n\n※ パスワード付与をご希望の場合、\n確認まで少々お時間をいただく場合があります🙇‍♀️"
      );

      return NextResponse.json({ ok: true });
    }

    if (!userMessage.startsWith("#")) {
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
      "こちらの案件に移動します。",
      `案件名【 ${data.title || "未設定"}】`,
      `詳細: https://app.1best.info/orders/${data.id}`,
    ].join("\n");

    await replyMessage(replyToken, text);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook route error:", e);
    return NextResponse.json({ ok: true });
  }
}
