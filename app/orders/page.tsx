"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import OrderCreateForm from "./OrderCreateForm";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  order_id: string;
  created_at: string;
  sender_name: string;
};

type OrderReadRow = {
  order_id: string;
  user_name: string;
  last_read_at: string;
};

type OrderWithMeta = OrderRow & {
  latest_message_at: string | null;
  unread: boolean;
};

export default function OrdersPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const load = async () => {
    setErr("");
    setLoading(true);

    const name = localStorage.getItem("user_name");

    if (!name) {
      router.push("/login");
      return;
    }

    setUserName(name);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false });

    if (orderError) {
      setErr(orderError.message);
      setLoading(false);
      return;
    }

    const baseOrders = (orderData ?? []) as OrderRow[];

    if (baseOrders.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = baseOrders.map((o) => o.id);

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("id,order_id,created_at,sender_name")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (messageError) {
      setErr(messageError.message);
      setLoading(false);
      return;
    }

    const { data: readData, error: readError } = await supabase
      .from("order_reads")
      .select("order_id,user_name,last_read_at")
      .eq("user_name", name)
      .in("order_id", orderIds);

    if (readError) {
      setErr(readError.message);
      setLoading(false);
      return;
    }

    const messages = (messageData ?? []) as MessageRow[];
    const reads = (readData ?? []) as OrderReadRow[];

    const latestMessageMap = new Map<string, MessageRow>();
    for (const msg of messages) {
      if (!latestMessageMap.has(msg.order_id)) {
        latestMessageMap.set(msg.order_id, msg);
      }
    }

    const readMap = new Map<string, OrderReadRow>();
    for (const read of reads) {
      readMap.set(read.order_id, read);
    }

    const merged: OrderWithMeta[] = baseOrders.map((order) => {
      const latestMessage = latestMessageMap.get(order.id);
      const readInfo = readMap.get(order.id);

      let unread = false;

      if (latestMessage) {
        if (!readInfo) {
          unread = latestMessage.sender_name !== name;
        } else {
          unread =
            latestMessage.sender_name !== name &&
            new Date(latestMessage.created_at).getTime() >
              new Date(readInfo.last_read_at).getTime();
        }
      }

      return {
        ...order,
        latest_message_at: latestMessage?.created_at ?? null,
        unread,
      };
    });

    setOrders(merged);
    setLoading(false);
  };

  const createDummy = async () => {
    setErr("");
    const title = `テスト案件 ${new Date().toLocaleString()}`;
    const name = localStorage.getItem("user_name");

    if (!name) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("orders").insert({
      title,
      status: "new",
      created_by_name: name,
    });

    if (error) {
      setErr(error.message);
    } else {
      load();
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("user_name");

    if (!saved) {
      router.push("/login");
      return;
    }

    setUserName(saved);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  const saved = localStorage.getItem("user_name");

  if (!saved) return;

  const channel = supabase
    .channel("orders-list-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
      },
      () => {
        load();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      () => {
        load();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_reads",
      },
      () => {
        load();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(#0f0f0f, #161616)",
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
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 5vw, 40px)",
              lineHeight: 1.2,
            }}
          >
            案件一覧
          </h1>

          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "rgba(255,255,255,0.75)",
              fontSize: 15,
            }}
          >
            ログイン中: {userName}
          </p>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            marginBottom: 18,
          }}
        >
          <OrderCreateForm onCreated={load} />
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 16,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={createDummy}
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
            ＋ テスト案件を追加
          </button>

          <button
            type="button"
            onClick={load}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            再読み込み
          </button>
        </div>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
        {err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

        {!loading && orders.length === 0 && (
          <div
            style={{
              marginTop: 18,
              padding: 24,
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            まだ案件がありません
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {orders.map((o) => {
            const statusColor =
              o.status === "new"
                ? "#3b82f6"
                : o.status === "done"
                ? "#22c55e"
                : "#a78bfa";

            const displayTime = o.latest_message_at ?? o.created_at;

            return (
              <a
                key={o.id}
                href={`/orders/${o.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "white",
                  background: "rgba(255,255,255,0.04)",
                  border: o.unread
                    ? "1px solid rgba(59,130,246,0.55)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 22,
                  padding: 18,
                  boxShadow: o.unread
                    ? "0 8px 30px rgba(30,64,175,0.18)"
                    : "0 8px 30px rgba(0,0,0,0.20)",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "clamp(20px, 3.4vw, 28px)",
                          lineHeight: 1.3,
                          wordBreak: "break-word",
                        }}
                      >
                        {o.title}
                      </h2>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: `${statusColor}22`,
                          color: statusColor,
                          border: `1px solid ${statusColor}55`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.status}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.65)",
                      }}
                    >
                      {o.latest_message_at ? "最新メッセージ" : "作成日"}:{" "}
                      {new Date(displayTime).toLocaleString()}
                    </p>
                  </div>

                  {o.unread && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 28,
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: "#ef4444",
                        color: "white",
                        fontSize: 6,
                        fontWeight: 800,
                        boxShadow: "0 6px 16px rgba(239,68,68,0.35)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      未読
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
