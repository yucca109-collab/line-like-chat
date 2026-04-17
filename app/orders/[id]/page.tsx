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

  const getStatusStyle = (status: string) => {
    if (status === "納品済み") {
      return {
        label: "納品済み",
        bg: "rgba(34,197,94,0.16)",
        color: "#86efac",
        border: "1px solid rgba(34,197,94,0.26)",
      };
    }

    if (status === "アーカイブ") {
      return {
        label: "アーカイブ",
        bg: "rgba(107,114,128,0.2)",
        color: "#d1d5db",
        border: "1px solid rgba(107,114,128,0.28)",
      };
    }

    return {
      label: "進行中",
      bg: "rgba(59,130,246,0.16)",
      color: "#93c5fd",
      border: "1px solid rgba(59,130,246,0.26)",
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

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
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

  const statusStyle = getStatusStyle(order?.status ?? "");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b1220 0%, #111827 55%, #172033 100%)",
        color: "white",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/orders")}
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 999,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← 一覧へ戻る
          </button>

          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.76)",
            }}
          >
            ログイン中：{userName || "読み込み中"}
          </div>
        </div>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
        {err && (
          <p
            style={{
              marginTop: 16,
              color: "#fca5a5",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.2)",
              padding: "12px 14px",
              borderRadius: 14,
            }}
          >
            エラー: {err}
          </p>
        )}

        {order && (
          <>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 22,
                boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
                backdropFilter: "blur(12px)",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.55)",
                      marginBottom: 8,
                      letterSpacing: "0.04em",
                    }}
                  >
                    ORDER DETAIL
                  </div>

                  <h1
                    style={{
                      margin: 0,
                      fontSize: "clamp(24px, 4vw, 34px)",
                      lineHeight: 1.25,
                      wordBreak: "break-word",
                    }}
                  >
                    {order.title}
                  </h1>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    border: statusStyle.border,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusStyle.label}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginTop: 18,
                }}
              >
                {[
                  { label: "店舗名", value: order.store_name || "未入力" },
                  { label: "担当者", value: order.contact_name || "未入力" },
                  { label: "作成者", value: order.created_by_name || "未入力" },
                  {
                    label: "作成日時",
                    value: new Date(order.created_at).toLocaleString(),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.56)",
                        marginBottom: 6,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 18,
                boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
                backdropFilter: "blur(12px)",
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
                  }}
                >
                  チャット
                </h2>

                <button
                  type="button"
                  onClick={loadAll}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 999,
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
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 24,
                  padding: 14,
                  height: 520,
                  overflowY: "auto",
                  overflowX: "hidden",
                  background: "rgba(7,12,23,0.55)",
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
                      color: "rgba(255,255,255,0.58)",
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
                    {messages.map((m) => {
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
                              maxWidth: "min(82%, 560px)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.48)",
                                marginBottom: 6,
                                textAlign: isMe ? "right" : "left",
                                wordBreak: "break-word",
                              }}
                            >
                              {m.sender_name} ・ {new Date(m.created_at).toLocaleString()}
                            </div>

                            <div
                              style={{
                                padding: "12px 14px",
                                borderRadius: isMe
                                  ? "22px 22px 8px 22px"
                                  : "22px 22px 22px 8px",
                                lineHeight: 1.65,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                                background: isMe
                                  ? "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)"
                                  : "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
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
                                    background: "rgba(255,255,255,0.06)",
                                  }}
                                />
                              )}
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
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 13,
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
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      color: "white",
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
                      color: "rgba(255,255,255,0.7)",
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
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.62)",
                        marginBottom: 10,
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
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
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
                              color: "rgba(255,255,255,0.68)",
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
                              background: "transparent",
                              color: "rgba(255,255,255,0.84)",
                              border: "1px solid rgba(255,255,255,0.14)",
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
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.07)",
                      color: "white",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: 15,
                    }}
                  />

                  <button
                    type="submit"
                    disabled={sending}
                    style={{
                      background: sending ? "#4b5563" : "#1a73e8",
                      color: "white",
                      border: "none",
                      borderRadius: 999,
                      padding: "13px 18px",
                      fontWeight: 800,
                      cursor: sending ? "default" : "pointer",
                      whiteSpace: "nowrap",
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
    </div>
  );
}
