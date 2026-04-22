"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

type Order = {
  id: string;
  title: string;
  status: string;
  store_name: string | null;
  contact_name: string | null;
  created_by_name: string | null;
  created_at: string;
};

type Message = {
  id: string;
  order_id: string;
  content: string | null;
  image_url?: string | null;
  sender_name: string;
  created_at: string;
};

type TypingRow = {
  user_name: string;
  is_typing: boolean;
  updated_at?: string | null;
};

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";

type MessageGroup =
  | {
      type: "single";
      message: Message;
    }
  | {
      type: "image-group";
      sender_name: string;
      created_at: string;
      isMe: boolean;
      images: Message[];
    };

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const messagesBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);

  const previewUrls = useMemo(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewUrls]);

  const getDisplayStatus = (status: string): DisplayStatus => {
    if (
      status === "新規" ||
      status === "進行中" ||
      status === "納品済み" ||
      status === "アーカイブ"
    ) {
      return status;
    }

    return "進行中";
  };

  const getStatusStyle = (status: DisplayStatus) => {
    if (status === "新規") {
      return {
        bg: "#f59e0b",
        text: "#ffffff",
        shadow: "0 6px 16px rgba(245,158,11,0.18)",
      };
    }

    if (status === "納品済み") {
      return {
        bg: "#22c55e",
        text: "#ffffff",
        shadow: "0 6px 16px rgba(34,197,94,0.16)",
      };
    }

    if (status === "アーカイブ") {
      return {
        bg: "#6b7280",
        text: "#ffffff",
        shadow: "0 6px 16px rgba(107,114,128,0.16)",
      };
    }

    return {
      bg: "#3b82f6",
      text: "#ffffff",
      shadow: "0 6px 16px rgba(59,130,246,0.16)",
    };
  };

  const loadAll = async () => {
    setErr("");
    setLoading(true);

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }
    setUserName(name);

    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("id,title,status,store_name,contact_name,created_by_name,created_at")
      .eq("id", orderId)
      .single();

    if (orderErr) {
      setErr(orderErr.message);
      setLoading(false);
      return;
    }

    setOrder(orderData as Order);

    const { data: msgData, error: msgErr } = await supabase
      .from("messages")
      .select("id,order_id,content,image_url,sender_name,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      setErr(msgErr.message);
    } else {
      setMessages((msgData ?? []) as Message[]);
    }

    setLoading(false);
    await markAsRead();
  };

  const syncTypingState = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const { data, error } = await supabase
      .from("typing_status")
      .select("user_name,is_typing,updated_at")
      .eq("order_id", orderId);

    if (error) return;

    const now = Date.now();

    const someoneTyping = ((data as TypingRow[] | null) ?? []).some((row) => {
      if (row.user_name === name) return false;
      if (!row.is_typing) return false;

      if (!row.updated_at) return true;

      const diff = now - new Date(row.updated_at).getTime();
      return diff < 3000;
    });

    setOtherTyping(someoneTyping);
  };

  const updateTyping = async (isTyping: boolean) => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const { data: existing } = await supabase
      .from("typing_status")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_name", name)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("typing_status")
        .update({
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("typing_status").insert({
        order_id: orderId,
        user_name: name,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const markAsRead = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const now = new Date().toISOString();

    const { data: existing, error: selectError } = await supabase
      .from("order_reads")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_name", name)
      .maybeSingle();

    if (selectError) {
      console.error("既読確認エラー:", selectError.message);
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("order_reads")
        .update({
          last_read_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("既読更新エラー:", updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from("order_reads")
        .insert({
          order_id: orderId,
          user_name: name,
          last_read_at: now,
          updated_at: now,
        });

      if (insertError) {
        console.error("既読作成エラー:", insertError.message);
      }
    }
  };

  const updateOrderStatus = async (nextStatus: DisplayStatus) => {
    setErr("");

    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      setErr(`ステータス更新エラー: ${error.message}`);
      return;
    }

    setOrder((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    await loadAll();
  };

  const clearTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const removeSelectedFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    setErr("");

    const content = input.trim();
    const name = localStorage.getItem("user_name");

    if (!name) {
      router.push("/login");
      return;
    }

    if (!content && files.length === 0) return;

    setSending(true);

    try {
      const uploadedImageUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data } = supabase.storage
          .from("chat-images")
          .getPublicUrl(filePath);

        uploadedImageUrls.push(data.publicUrl);
      }

      const rowsToInsert: {
        order_id: string;
        content: string | null;
        image_url: string | null;
        sender_name: string;
      }[] = [];

      if (content || uploadedImageUrls.length === 0) {
        rowsToInsert.push({
          order_id: orderId,
          content: content || null,
          image_url: null,
          sender_name: name,
        });
      }

      for (const imageUrl of uploadedImageUrls) {
        rowsToInsert.push({
          order_id: orderId,
          content: null,
          image_url: imageUrl,
          sender_name: name,
        });
      }

      const { data: insertedRows, error } = await supabase
        .from("messages")
        .insert(rowsToInsert)
        .select("id,order_id,content,image_url,sender_name,created_at");

      if (error) {
        throw new Error(error.message);
      }

      if (insertedRows) {
        setMessages((prev) => {
          const next = [...prev];
          for (const row of insertedRows as Message[]) {
            if (!next.some((m) => m.id === row.id)) {
              next.push(row);
            }
          }
          return next;
        });
      }

      await markAsRead();
      clearTypingTimer();
      setInput("");
      setFiles([]);
      await updateTyping(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!messagesBoxRef.current) return;
    messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!orderId) return;

    const messageChannel = supabase
      .channel(`messages-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_id: string;
            content: string | null;
            image_url?: string | null;
            sender_name: string;
            created_at: string;
          };

          const newMessage: Message = {
            id: row.id,
            order_id: row.order_id,
            content: row.content ?? null,
            image_url: row.image_url ?? null,
            sender_name: row.sender_name,
            created_at: row.created_at,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    const orderChannel = supabase
      .channel(`order-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Order;
          if (row) {
            setOrder(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    syncTypingState();

    const channel = supabase
      .channel(`typing-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          syncTypingState();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncTypingState();
        }
      });

    const interval = setInterval(() => {
      syncTypingState();
    }, 2000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, []);

  const groupedMessages: MessageGroup[] = [];
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const isImageOnly = !current.content && !!current.image_url;

    if (!isImageOnly) {
      groupedMessages.push({ type: "single", message: current });
      continue;
    }

    const group: Message[] = [current];
    let j = i + 1;

    while (j < messages.length) {
      const next = messages[j];
      const nextIsImageOnly = !next.content && !!next.image_url;

      const closeInTime =
        Math.abs(
          new Date(next.created_at).getTime() - new Date(current.created_at).getTime()
        ) < 60 * 1000;

      if (
        nextIsImageOnly &&
        next.sender_name === current.sender_name &&
        closeInTime
      ) {
        group.push(next);
        j++;
      } else {
        break;
      }
    }

    if (group.length === 1) {
      groupedMessages.push({ type: "single", message: current });
    } else {
      groupedMessages.push({
        type: "image-group",
        sender_name: current.sender_name,
        created_at: current.created_at,
        isMe: current.sender_name === userName,
        images: group,
      });
      i = j - 1;
    }
  }

  const currentStatus = getDisplayStatus(order?.status ?? "");
  const statusStyle = getStatusStyle(currentStatus);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7fafc 0%, #eef3f8 100%)",
        color: "#0f172a",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/orders")}
            style={{
              background: "#ffffff",
              color: "#334155",
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            }}
          >
            ← 一覧へ戻る
          </button>

          <div
            style={{
              fontSize: 15,
              color: "#475569",
              fontWeight: 600,
            }}
          >
            ログイン中：{userName || "読み込み中"}
          </div>
        </div>

        {loading && (
          <p style={{ marginTop: 16, color: "#475569" }}>
            読み込み中...
          </p>
        )}

        {err && (
          <p
            style={{
              marginTop: 16,
              color: "#dc2626",
              background: "#ffffff",
              border: "1px solid #fecaca",
              padding: "12px 14px",
              borderRadius: 14,
              boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
            }}
          >
            エラー: {err}
          </p>
        )}

        {order && (
          <>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 36,
                padding: "24px 24px 20px",
                boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
                marginBottom: 20,
              }}
            >
              <div className="detailTop">
                <div className="detailMain">
                  <div className="detailLabelHead">ORDER DETAIL</div>
                  <h1 className="detailTitle">{order.title}</h1>

                  <div className="detailInfoGrid">
                    <div>
                      <div className="detailMiniLabel">店舗名</div>
                      <div className="detailMiniValue">{order.store_name || "未入力"}</div>
                    </div>

                    <div className="detailDividerBlock">
                      <div className="detailMiniLabel">依頼者名</div>
                      <div className="detailMiniValue">{order.contact_name || "未入力"}</div>
                    </div>

                    <div className="detailDividerBlock">
                      <div className="detailMiniLabel">作成者</div>
                      <div className="detailMiniValue">{order.created_by_name || "未入力"}</div>
                    </div>

                    <div className="detailDividerBlock">
                      <div className="detailMiniLabel">作成日時</div>
                      <div className="detailMiniValue">
                        {new Date(order.created_at).toLocaleString("ja-JP")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detailStatusWrap">
                  <div
                    style={{
                      minWidth: 118,
                      height: 44,
                      borderRadius: 999,
                      padding: "0 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: statusStyle.bg,
                      color: statusStyle.text,
                      fontWeight: 900,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      boxShadow: statusStyle.shadow,
                    }}
                  >
                    {currentStatus}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1.5px solid #94a3b8",
                }}
              >
                {(["新規", "進行中", "納品済み", "アーカイブ"] as const).map((status) => {
                  const active = currentStatus === status;
                  const style = getStatusStyle(status);

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateOrderStatus(status)}
                      style={{
                        border: "none",
                        borderRadius: 999,
                        padding: "10px 14px",
                        fontWeight: 800,
                        cursor: "pointer",
                        background: active ? style.bg : "#ffffff",
                        color: active ? style.text : "#334155",
                        boxShadow: active ? style.shadow : "none",
                        borderColor: active ? "transparent" : "#e5e7eb",
                        borderWidth: 1,
                        borderStyle: "solid",
                      }}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 36,
                padding: 18,
                boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "clamp(22px, 3vw, 28px)",
                    color: "#0f172a",
                  }}
                >
                  チャット
                </h2>

                <button
                  type="button"
                  onClick={loadAll}
                  style={{
                    background: "#ffffff",
                    color: "#334155",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  再読み込み
                </button>
              </div>

              <div
                ref={messagesBoxRef}
                style={{
                  border: "1px solid #b7d7c0",
                  borderRadius: 28,
                  padding: 16,
                  height: 560,
                  overflowY: "auto",
                  overflowX: "hidden",
                  background:
                    "linear-gradient(180deg, #bfe8b8 0%, #b7e3b0 100%)",
                  boxSizing: "border-box",
                }}
              >
                {messages.length === 0 ? (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(15,23,42,0.55)",
                      fontWeight: 700,
                    }}
                  >
                    まだメッセージがありません
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {groupedMessages.map((group, index) => {
                      if (group.type === "single") {
                        const m = group.message;
                        const isMe = m.sender_name === userName;

                        return (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              justifyContent: isMe ? "flex-end" : "flex-start",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                maxWidth: "min(78%, 520px)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "rgba(15,23,42,0.55)",
                                  marginBottom: 6,
                                  textAlign: isMe ? "right" : "left",
                                  wordBreak: "break-word",
                                  fontWeight: 700,
                                }}
                              >
                                {m.sender_name} ・ {new Date(m.created_at).toLocaleString("ja-JP")}
                              </div>

                              <div
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: isMe
                                    ? "20px 20px 6px 20px"
                                    : "20px 20px 20px 6px",
                                  lineHeight: 1.65,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                  background: isMe ? "#8de055" : "#ffffff",
                                  color: "#0f172a",
                                  border: isMe
                                    ? "1px solid rgba(86,170,40,0.28)"
                                    : "1px solid rgba(15,23,42,0.06)",
                                  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                                }}
                              >
                                {m.content && <div>{m.content}</div>}

                                {m.image_url && (
                                  <img
                                    src={m.image_url}
                                    alt="送信画像"
                                    style={{
                                      width: "100%",
                                      maxWidth: 280,
                                      height: "auto",
                                      borderRadius: 14,
                                      marginTop: m.content ? 10 : 0,
                                      display: "block",
                                      objectFit: "cover",
                                      background: "#f8fafc",
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${group.sender_name}-${group.created_at}-${index}`}
                          style={{
                            display: "flex",
                            justifyContent: group.isMe ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              maxWidth: "min(78%, 520px)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: "rgba(15,23,42,0.55)",
                                marginBottom: 6,
                                textAlign: group.isMe ? "right" : "left",
                                fontWeight: 700,
                              }}
                            >
                              {group.sender_name} ・ {new Date(group.created_at).toLocaleString("ja-JP")}
                            </div>

                            <div
                              style={{
                                padding: "12px 14px",
                                borderRadius: group.isMe
                                  ? "20px 20px 6px 20px"
                                  : "20px 20px 20px 6px",
                                background: group.isMe ? "#8de055" : "#ffffff",
                                border: group.isMe
                                  ? "1px solid rgba(86,170,40,0.28)"
                                  : "1px solid rgba(15,23,42,0.06)",
                                boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    group.images.length === 1
                                      ? "1fr"
                                      : "repeat(2, minmax(0, 1fr))",
                                  gap: 8,
                                }}
                              >
                                {group.images.map((img) => (
                                  <img
                                    key={img.id}
                                    src={img.image_url || ""}
                                    alt="送信画像"
                                    style={{
                                      width: "100%",
                                      aspectRatio: "1 / 1",
                                      objectFit: "cover",
                                      borderRadius: 12,
                                      display: "block",
                                      background: "#f8fafc",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={{
                  minHeight: 28,
                  display: "flex",
                  alignItems: "center",
                  marginTop: 10,
                  color: "#4b5563",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {otherTyping ? "入力中..." : ""}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                style={{
                  marginTop: 4,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <label
                    htmlFor="image-upload"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      color: "#334155",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    画像を追加
                  </label>

                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      if (selected.length === 0) return;

                      setFiles((prev) => [...prev, ...selected]);
                      e.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                  />

                  <div
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      wordBreak: "break-word",
                    }}
                  >
                    {files.length > 0
                      ? `${files.length}件の画像を選択中`
                      : "画像はまだ選択されていません"}
                  </div>
                </div>

                {previewUrls.length > 0 && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 20,
                      background: "#f8fafc",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginBottom: 10,
                        fontWeight: 600,
                      }}
                    >
                      選択中の画像
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {previewUrls.map((item, index) => (
                        <div
                          key={`${item.file.name}-${index}`}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 8,
                          }}
                        >
                          <img
                            src={item.url}
                            alt={`プレビュー ${index + 1}`}
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              objectFit: "cover",
                              borderRadius: 12,
                              display: "block",
                            }}
                          />

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              color: "#64748b",
                              wordBreak: "break-all",
                              lineHeight: 1.45,
                              minHeight: 32,
                            }}
                          >
                            {item.file.name}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSelectedFile(index)}
                            style={{
                              marginTop: 8,
                              width: "100%",
                              background: "#ffffff",
                              color: "#334155",
                              border: "1px solid #e5e7eb",
                              borderRadius: 999,
                              padding: "8px 10px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            取り消す
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInput(value);

                      if (!value.trim()) {
                        updateTyping(false);
                        clearTypingTimer();
                        return;
                      }

                      updateTyping(true);
                      clearTypingTimer();

                      typingTimeoutRef.current = setTimeout(() => {
                        updateTyping(false);
                        typingTimeoutRef.current = null;
                      }, 1500);
                    }}
                    onBlur={() => {
                      updateTyping(false);
                      clearTypingTimer();
                    }}
                    placeholder="メッセージを入力"
                    style={{
                      flex: "1 1 280px",
                      minWidth: 0,
                      padding: "15px 18px",
                      borderRadius: 999,
                      border: "1px solid #dbe2ea",
                      background: "#ffffff",
                      color: "#334155",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: 15,
                    }}
                  />

                  <button
                    type="submit"
                    disabled={sending}
                    style={{
                      background: sending ? "#9ca3af" : "#06c755",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 16,
                      padding: "13px 18px",
                      fontWeight: 800,
                      cursor: sending ? "default" : "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 10px 24px rgba(6,199,85,0.22)",
                    }}
                  >
                    {sending ? "送信中..." : "送信"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        input:focus {
          border-color: #94a3b8 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.12);
        }

        button:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.2s ease;
        }

        .detailTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
        }

        .detailMain {
          min-width: 0;
          flex: 1;
        }

        .detailLabelHead {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        .detailTitle {
          margin: 0;
          font-size: clamp(24px, 4vw, 30px);
          line-height: 1.25;
          color: #0f172a;
          word-break: break-word;
        }

        .detailInfoGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .detailDividerBlock {
          padding-left: 16px;
          border-left: 1.5px solid #94a3b8;
        }

        .detailMiniLabel {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
          font-weight: 700;
        }

        .detailMiniValue {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
          line-height: 1.35;
          word-break: break-word;
        }

        .detailStatusWrap {
          flex-shrink: 0;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
        }

        @media (max-width: 900px) {
          .detailTop {
            flex-direction: column;
            align-items: stretch;
          }

          .detailStatusWrap {
            justify-content: flex-start;
          }

          .detailInfoGrid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .detailDividerBlock {
            padding-left: 0;
            border-left: none;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
          }
        }
      `}</style>
    </div>
  );
}
