"use client";

import { useEffect, useRef, useState } from "react";
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
  const [err, setErr] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [otherTyping, setOtherTyping] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

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

  const clearTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const sendMessage = async () => {
    setErr("");
    const content = input.trim();

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    let imageUrl: string | null = null;

    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `chat/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file);

      if (uploadError) {
        setErr(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      imageUrl = data.publicUrl;
    }

    if (!content && !imageUrl) return;

    const { data: insertedMessage, error } = await supabase
      .from("messages")
      .insert({
        order_id: orderId,
        content: content || null,
        image_url: imageUrl,
        sender_name: name,
      })
      .select("id,order_id,content,image_url,sender_name,created_at")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    if (insertedMessage) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === insertedMessage.id)) return prev;
        return [...prev, insertedMessage as Message];
      });
    }

    clearTypingTimer();
    setInput("");
    setFile(null);
    setPreviewUrl("");
    await updateTyping(false);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(#0f0f0f, #161616)",
        color: "white",
        display: "flex",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/orders")}
          style={{
            background: "transparent",
            color: "white",
            border: "none",
            cursor: "pointer",
            marginBottom: 20,
            fontSize: 16,
            padding: 0,
          }}
        >
          ← 一覧へ
        </button>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
        {err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

        {order && (
          <div style={{ marginTop: 16 }}>
            <h1
              style={{
                marginBottom: 12,
                fontSize: "clamp(22px, 4vw, 32px)",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {order.title}
            </h1>

            <p>status: {order.status}</p>
            <p>店舗名: {order.store_name || "未入力"}</p>
            <p>担当者: {order.contact_name || "未入力"}</p>
            <p>作成者: {order.created_by_name || "未入力"}</p>
            <p>created: {new Date(order.created_at).toLocaleString()}</p>

            <hr style={{ margin: "24px 0", borderColor: "rgba(255,255,255,0.12)" }} />

            <h2 style={{ marginBottom: 12 }}>チャット</h2>

            <div
              ref={messagesBoxRef}
              style={{
                marginTop: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
                padding: 14,
                height: 500,
                overflowY: "auto",
                overflowX: "hidden",
                background: "rgba(255,255,255,0.04)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                boxSizing: "border-box",
              }}
            >
              {messages.length === 0 ? (
                <p style={{ opacity: 0.7 }}>まだメッセージがありません</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                  {messages.map((m) => {
                    const isMe = m.sender_name === userName;

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: isMe ? "flex-end" : "flex-start",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "min(82%, 520px)",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.55,
                              marginBottom: 6,
                              textAlign: isMe ? "right" : "left",
                              letterSpacing: "0.02em",
                              wordBreak: "break-word",
                            }}
                          >
                            {m.sender_name} / {new Date(m.created_at).toLocaleString()}
                          </div>

                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: 22,
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              background: isMe ? "#1f6f3c" : "rgba(255,255,255,0.14)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                              boxSizing: "border-box",
                              maxWidth: "100%",
                            }}
                          >
                            {m.content && <div>{m.content}</div>}

                            {m.image_url && (
                              <img
                                src={m.image_url}
                                alt="送信画像"
                                style={{
                                  width: "100%",
                                  maxWidth: 260,
                                  height: "auto",
                                  borderRadius: 12,
                                  marginTop: m.content ? 8 : 0,
                                  display: "block",
                                  objectFit: "cover",
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

            {otherTyping && (
              <p style={{ marginTop: 8, marginBottom: 8, opacity: 0.7 }}>
                入力中...
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 0,
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
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  画像を選ぶ
                </label>

                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                  }}
                  style={{ display: "none" }}
                />

                <span
                  style={{
                    fontSize: 13,
                    opacity: 0.75,
                    wordBreak: "break-word",
                  }}
                >
                  {file ? file.name : "ファイルは選択されていません"}
                </span>
              </div>

              {file && previewUrl && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxSizing: "border-box",
                  }}
                >
                  <p style={{ margin: 0, marginBottom: 8, fontSize: 12, opacity: 0.75 }}>
                    選択中の画像
                  </p>

                  <img
                    src={previewUrl}
                    alt="プレビュー"
                    style={{
                      width: "100%",
                      maxWidth: 220,
                      height: "auto",
                      borderRadius: 12,
                      display: "block",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl("");
                    }}
                    style={{
                      marginTop: 10,
                      background: "transparent",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 999,
                      padding: "8px 12px",
                      cursor: "pointer",
                    }}
                  >
                    選択を取り消す
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  minWidth: 0,
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
                    flex: "1 1 260px",
                    minWidth: 0,
                    padding: "14px 18px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                <button
                  type="submit"
                  style={{
                    background: "#1a73e8",
                    color: "white",
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 18px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  送信
                </button>

                <button
                  type="button"
                  onClick={loadAll}
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.7)",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  再読み込み
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
