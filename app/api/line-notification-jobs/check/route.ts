import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "LINE token missing" }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("line_notification_jobs")
    .select(`
      id,
      order_id,
      message_id,
      recipient_line_user_id,
      recipient_name,
      sender_name,
      notify_at,
      messages (
        id,
        created_at
      ),
      orders (
        display_id,
        title
      )
    `)
    .is("sent_at", null)
    .is("skipped_at", null)
    .lte("notify_at", now)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const job of jobs ?? []) {
    const messageCreatedAt =
      Array.isArray(job.messages)
        ? job.messages[0]?.created_at
        : job.messages?.created_at;

    const order =
      Array.isArray(job.orders) ? job.orders[0] : job.orders;

    if (!messageCreatedAt) {
      await supabase
        .from("line_notification_jobs")
        .update({
          skipped_at: now,
          skip_reason: "message_not_found",
        })
        .eq("id", job.id);

      skipped++;
      continue;
    }

    const { data: readInfo } = await supabase
      .from("order_reads")
      .select("last_read_at")
      .eq("order_id", job.order_id)
      .eq("user_name", job.recipient_name)
      .maybeSingle();

    if (
      readInfo?.last_read_at &&
      new Date(readInfo.last_read_at).getTime() >=
        new Date(messageCreatedAt).getTime()
    ) {
      await supabase
        .from("line_notification_jobs")
        .update({
          skipped_at: now,
          skip_reason: "already_read",
        })
        .eq("id", job.id);

      skipped++;
      continue;
    }

    const displayId = order?.display_id || "未採番";
    const title = order?.title || "案件";

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: job.recipient_line_user_id,
        messages: [
          {
            type: "flex",
            altText: "未読メッセージがあります",
            contents: {
              type: "bubble",
              size: "mega",
              body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: "未読メッセージがあります",
                    weight: "bold",
                    size: "xl",
                    color: "#111111",
                  },
                  {
                    type: "text",
                    text: `オーダーID：${displayId}`,
                    size: "sm",
                    color: "#666666",
                    wrap: true,
                  },
                  {
                    type: "text",
                    text: title,
                    size: "sm",
                    color: "#111111",
                    wrap: true,
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#dc2626",
                    action: {
                      type: "uri",
                      label: "案件を見る",
                      uri: `https://app.1best.info/orders/${job.order_id}`,
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();

      await supabase
        .from("line_notification_jobs")
        .update({
          skipped_at: now,
          skip_reason: errorText,
        })
        .eq("id", job.id);

      skipped++;
      continue;
    }

    await supabase
      .from("line_notification_jobs")
      .update({
        sent_at: now,
      })
      .eq("id", job.id);

    sent++;
  }

  return NextResponse.json({
    ok: true,
    checked: jobs?.length ?? 0,
    sent,
    skipped,
  });
}
