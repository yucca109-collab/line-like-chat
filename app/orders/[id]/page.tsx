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
  created_at: string;
};

type Message = {
  id: string;
  content: string | null;
  image_url: string | null;
  sender_name: string;
  created_at: string;
};

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const boxRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: DisplayStatus) => {
    if (status === "新規") return "#f59e0b";
    if (status === "納品済み") return "#22c55e";
    if (status === "アーカイブ") return "#6b7280";
    return "#3b82f6";
  };

  const load = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return router.push("/login");
    setUserName(name);

    const { data: o } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    setOrder(o);

    const { data: m } = await supabase
      .from("messages")
      .select("*")
      .eq("order_id", id)
      .order("created_at");

    setMessages(m || []);
  };

  const updateStatus = async (next: DisplayStatus) => {
    await supabase.from("orders").update({ status: next }).eq("id", id);
    await load();
  };

  const send = async () => {
    if (!input && files.length === 0) return;

    const name = localStorage.getItem("user_name");

    const uploads: string[] = [];

    for (const file of files) {
      const path = `chat/${Date.now()}-${file.name}`;
      await supabase.storage.from("chat-images").upload(path, file);
      const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
      uploads.push(data.publicUrl);
    }

    const rows: any[] = [];

    if (input) {
      rows.push({
        order_id: id,
        content: input,
        image_url: null,
        sender_name: name,
      });
    }

    uploads.forEach((url) => {
      rows.push({
        order_id: id,
        content: null,
        image_url: url,
        sender_name: name,
      });
    });

    await supabase.from("messages").insert(rows);

    setInput("");
    setFiles([]);
    load();
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages]);

  if (!order) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg,#f8fafc 0%,#eef2f7 50%,#e8edf5 100%)",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* 戻る */}
        <button onClick={() => router.push("/orders")}>← 戻る</button>

        {/* ヘッダー */}
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 20,
            marginTop: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.05)",
          }}
        >
          <h2>{order.title}</h2>

          {/* ステータス */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["新規", "進行中", "納品済み", "アーカイブ"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  style={{
                    background: getStatusColor(s),
                    color: "#fff",
                    borderRadius: 999,
                    padding: "6px 12px",
                    border: "none",
                  }}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>

        {/* チャット */}
        <div
          ref={boxRef}
          style={{
            marginTop: 16,
            height: 400,
            overflow: "auto",
            background: "#fff",
            borderRadius: 24,
            padding: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.05)",
          }}
        >
          {messages.map((m) => {
            const me = m.sender_name === userName;

            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: me ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    background: me ? "#3b82f6" : "#e2e8f0",
                    color: me ? "#fff" : "#000",
                    padding: 10,
                    borderRadius: 16,
                    maxWidth: 260,
                  }}
                >
                  {m.content}
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      style={{ width: "100%", marginTop: 8 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 入力 */}
        <div
          style={{
            marginTop: 12,
            background: "#fff",
            padding: 16,
            borderRadius: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.05)",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />

          <input
            type="file"
            multiple
            onChange={(e) =>
              setFiles(Array.from(e.target.files || []))
            }
          />

          <button onClick={send}>送信</button>
        </div>
      </div>
    </div>
  );
}
