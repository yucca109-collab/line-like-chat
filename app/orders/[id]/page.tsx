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
    await updateTyping(false);
    loadAll();
  };

  // メッセージ realtime
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

  // typing realtime
  useEffect(() => {
    if (!orderId) return;

    const name = localStorage.getItem("user_name");
    if (!name) return;

    const channel = supabase
      .channel("typing-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `order_id=eq.${orderId}`,
        },
        async () => {
          const { data } = await supabase
            .from("typing_status")
            .select("user_name,is_typing")
            .eq("order_id", orderId);

          const someoneTyping = (data ?? []).some(
            (row) => row.user_name !== name && row.is_typing === true
          );

          setOtherTyping(someoneTyping);
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

            <hr style={{ margin: "24px 0" }} />

            <h2>チャット</h2>

            <div style={{ height: 420, overflowY: "auto" }}>
              {messages.map((m) => {
                const isMe = m.sender_name === userName;

                return (
                  <div key={m.id} style={{ textAlign: isMe ? "right" : "left" }}>
                    <div>{m.sender_name}</div>
                    <div>{m.content}</div>
                  </div>
                );
              })}
            </div>

            {/* 👇 これが入力中 */}
            {otherTyping && <p>入力中...</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);

                  updateTyping(true);

                  if (typingTimer) clearTimeout(typingTimer);

                  const timer = setTimeout(() => {
                    updateTyping(false);
                  }, 1500);

                  setTypingTimer(timer);
                }}
              />

              <button type="submit">送信</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
