"use client";

import { useEffect, useState } from "react";
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
  content: string;
  sender_name: string;
  created_at: string;
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");

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
      .select("id,order_id,content,sender_name,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      setErr(msgErr.message);
    } else {
      setMessages((msgData ?? []) as Message[]);
    }

    setLoading(false);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content) return;

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("messages").insert({
      order_id: orderId,
      content,
      sender_name: name,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setInput("");
    loadAll();
  };

useEffect(() => {
  if (!orderId) return;
  loadAll();

  const channel = supabase
    .channel("messages-realtime")
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

        setMessages((prev) => [...prev, newMessage]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [orderId]);

  return (
    <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <button type="button" onClick={() => router.push("/orders")}>
          ← 一覧へ
        </button>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
        {err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

        {order && (
          <div style={{ marginTop: 16 }}>
            <h1>{order.title}</h1>
            <p>status: {order.status}</p>
            <p>店舗名: {order.store_name || "未入力"}</p>
            <p>担当者: {order.contact_name || "未入力"}</p>
            <p>作成者: {order.created_by_name || "未入力"}</p>
            <p>created: {new Date(order.created_at).toLocaleString()}</p>

            <hr style={{ margin: "24px 0" }} />

            <h2>チャット</h2>

            <div
              style={{
                marginTop: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 16,
                padding: 16,
                height: 420,
                overflowY: "auto",
                background: "rgba(255,255,255,0.03)",
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
                        <div style={{ maxWidth: "70%" }}>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.6,
                              marginBottom: 4,
                              textAlign: isMe ? "right" : "left",
                            }}
                          >
                            {m.sender_name} / {new Date(m.created_at).toLocaleString()}
                          </div>

                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 16,
                              lineHeight: 1.5,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: isMe
                                ? "rgba(34,197,94,0.25)"
                                : "rgba(255,255,255,0.10)",
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          >
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                onChange={(e) => setInput(e.target.value)}
                placeholder="メッセージを入力"
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.2)",
                  color: "white",
                  outline: "none",
                }}
              />

              <button type="submit">送信</button>

              <button type="button" onClick={loadAll}>
                再読み込み
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
