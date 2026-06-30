import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function pushLineMessage(to: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LINE push error: ${errText}`);
  }
}

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data: jobs, error: jobsError } = await supabase
      .from("line_notification_jobs")
      .select(
        `
        id,
        order_id,
        message_id,
        sender_line_user_id,
        sender_name,
        recipient_line_user_id,
        recipient_name,
        notify_at,
        sent_at,
        orders (
          id,
          display_id,
          title,
          store_name
        ),
        messages (
          id,
          created_at,
          content,
          image_url,
          sender_name
        )
      `
      )
      .lte("notify_at", now)
      .is("sent_at", null)
      .limit(20);

    if (jobsError) {
      throw new Error(`通知ジョブ取得エラー: ${jobsError.message}`);
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const job of jobs ?? []) {
      const messageCreatedAt = job.messages?.created_at;

      if (!messageCreatedAt) {
        skippedCount++;
        continue;
      }

      const { data: readRow, error: readError } = await supabase
        .from("order_reads")
        .select("last_read_at")
        .eq("order_id", job.order_id)
        .eq("user_name", job.recipient_name)
        .maybeSingle();

      if (readError) {
        console.error("既読確認エラー:", readError.message);
        skippedCount++;
        continue;
      }

      const lastReadAt = readRow?.last_read_at || null;
      const isUnread =
        !lastReadAt ||
        new Date(lastReadAt).getTime() < new Date(messageCreatedAt).getTime();

      if (!isUnread) {
        await supabase
          .from("line_notification_jobs")
          .update({
            sent_at: now,
            skipped_reason: "already_read",
          })
          .eq("id", job.id);

        skippedCount++;
        continue;
      }

      const order = Array.isArray(job.orders) ? job.orders[0] : job.orders;
      const message = Array.isArray(job.messages) ? job.messages[0] : job.messages;

      const preview =
        message?.content ||
        (message?.image_url ? "画像が送信されました" : "新しいメッセージがあります");

      const text = [
        "未読の返信があります。",
        "",
        `案件：${order?.display_id || ""} ${order?.title || "未設定"}`,
        order?.store_name ? `店舗：${order.store_name}` : "",
        `送信者：${job.sender_name || "不明"}`,
        "",
        preview,
        "",
        `確認：https://app.1best.info/orders/${job.order_id}`,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await pushLineMessage(job.recipient_line_user_id, text);

        await supabase
          .from("line_notification_jobs")
          .update({
            sent_at: now,
            skipped_reason: null,
          })
          .eq("id", job.id);

        sentCount++;
      } catch (e) {
        console.error("LINE未読通知送信エラー:", e);

        await supabase
          .from("line_notification_jobs")
          .update({
            error_message: e instanceof Error ? e.message : String(e),
          })
          .eq("id", job.id);

        skippedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      checked: jobs?.length ?? 0,
      sent: sentCount,
      skipped: skippedCount,
    });
  } catch (e) {
    console.error("unread-check error:", e);

    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
