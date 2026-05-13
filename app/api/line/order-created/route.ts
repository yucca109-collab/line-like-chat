import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const designerLineUserId = process.env.DESIGNER_LINE_USER_ID;

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

    const targets = [lineUserId, designerLineUserId].filter(
      (target): target is string => Boolean(target)
    );

    for (const target of targets) {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          to: target,

          messages: [
            {
              type: "flex",
              altText: "案件受付完了",

              contents: {
                type: "bubble",
                size: "giga",

                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",

                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      spacing: "sm",

                      contents: [
                        {
                          type: "text",
                          text: "📦",
                          size: "lg",
                          flex: 0,
                        },

                        {
                          type: "text",
                          text: "案件受付完了",
                          weight: "bold",
                          size: "xl",
                          color: "#111111",
                        },
                      ],
                    },

                    {
                      type: "text",
                      text: "案件を受け付けました。",
                      size: "sm",
                      color: "#666666",
                      wrap: true,
                    },

                    {
                      type: "separator",
                      margin: "md",
                    },

                    {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      margin: "md",

                      contents: [
                        {
                          type: "box",
                          layout: "baseline",

                          contents: [
                            {
                              type: "text",
                              text: "🏷 オーダーID",
                              size: "sm",
                              color: "#888888",
                              flex: 3,
                            },

                            {
                              type: "text",
                              text: displayId || "未採番",
                              size: "sm",
                              weight: "bold",
                              color: "#111111",
                              flex: 5,
                              wrap: true,
                            },
                          ],
                        },

                        {
                          type: "box",
                          layout: "baseline",

                          contents: [
                            {
                              type: "text",
                              text: "📝 案件名",
                              size: "sm",
                              color: "#888888",
                              flex: 3,
                            },

                            {
                              type: "text",
                              text: title || "未入力",
                              size: "sm",
                              weight: "bold",
                              color: "#111111",
                              flex: 5,
                              wrap: true,
                            },
                          ],
                        },

                        {
                          type: "box",
                          layout: "baseline",

                          contents: [
                            {
                              type: "text",
                              text: "🏠 店舗名",
                              size: "sm",
                              color: "#888888",
                              flex: 3,
                            },

                            {
                              type: "text",
                              text: storeName || "未入力",
                              size: "sm",
                              weight: "bold",
                              color: "#111111",
                              flex: 5,
                              wrap: true,
                            },
                          ],
                        },

                        {
                          type: "box",
                          layout: "baseline",

                          contents: [
                            {
                              type: "text",
                              text: "👤 担当者",
                              size: "sm",
                              color: "#888888",
                              flex: 3,
                            },

                            {
                              type: "text",
                              text: contactName || "未入力",
                              size: "sm",
                              weight: "bold",
                              color: "#111111",
                              flex: 5,
                              wrap: true,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },

                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",

                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#111827",

                      action: {
                        type: "uri",
                        label: "📂 案件を確認する",
                        uri: orderUrl,
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

        return NextResponse.json(
          { error: errorText },
          { status: res.status }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      sentTo: targets.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
