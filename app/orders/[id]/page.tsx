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
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  const messagesBoxRef = useRef<HTMLDivElement | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [otherTyping, setOtherTyping] = useState(false);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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
      .select("user_name,is_typing")
      .eq("order_id", orderId);

    if (error) return;

    const someoneTyping = ((data as TypingRow[] | null) ?? []).some(
      (row) => row.user_name !== name && row.is_typing === true
    );

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

  const sendMessage = async () => {
    const content = input.trim();

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    let imageUrl: string | null = null;

    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
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

    const { error } = await supabase.from("messages").insert({
      order_id: orderId,
      content: content || null,
      image_url: imageUrl,
      sender_name: name,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setInput("");
    setFile(null);
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
          const newMessage = payload.new as Message;

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(#0f0f0f, #161616)",
        color: "white",
        display: "flex",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 760 }}>
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
          }}
        >
          ← 一覧へ
        </button>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
        {err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

        {order && (
          <div style={{ marginTop: 16 }}>
            <h1 style={{ marginBottom: 12 }}>{order.title}</h1>
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
                padding: 20,
                height: 500,
                overflowY: "auto",
                background: "rgba(255,255,255,0.04)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              }}
            >
              {messages.length === 0 ? (
                <p style={{ opacity: 0.7 }}>まだメッセージがありません</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                        <div style={{ maxWidth: "60%" }}>
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.55,
                              marginBottom: 6,
                              textAlign: isMe ? "right" : "left",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {m.sender_name} / {new Date(m.created_at).toLocaleString()}
                          </div>

                          <div
                            style={{
                              padding: "12px 16px",
                              borderRadius: 22,
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: isMe ? "#1f6f3c" : "rgba(255,255,255,0.14)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                            }}
                          >
                            {m.content && <div>{m.content}</div>}

                            {m.image_url && (
                              <img
                                src={m.image_url}
                                alt="送信画像"
                                style={{
                                  maxWidth: "200px",
                                  borderRadius: 12,
                                  marginTop: m.content ? 8 : 0,
                                  display: "block",
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
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={input}
                onChange={(e) => {
                  const value = e.target.value;
                  setInput(value);

                  if (!value.trim()) {
                    updateTyping(false);
                    if (typingTimer) clearTimeout(typingTimer);
                    return;
                  }

                  updateTyping(true);

                  if (typingTimer) clearTimeout(typingTimer);

                  const timer = setTimeout(() => {
                    updateTyping(false);
                  }, 1500);

                  setTypingTimer(timer);
                }}
                placeholder="メッセージを入力"
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "14px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
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
                }}
              >
                再読み込み
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
