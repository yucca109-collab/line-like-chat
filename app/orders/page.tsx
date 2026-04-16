"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  store_name: string | null;
  contact_name: string | null;
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
  unread_count: number;
};

export default function OrdersPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    setUserName(name);
    setErr("");
    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,title,status,created_at,store_name,contact_name")
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

      const orderMessages = messages.filter((msg) => msg.order_id === order.id);

      let unreadCount = 0;

      if (!readInfo) {
        unreadCount = orderMessages.filter((msg) => msg.sender_name !== name).length;
      } else {
        unreadCount = orderMessages.filter(
          (msg) =>
            msg.sender_name !== name &&
            new Date(msg.created_at).getTime() >
              new Date(readInfo.last_read_at).getTime()
        ).length;
      }

      return {
        ...order,
        latest_message_at: latestMessage?.created_at ?? null,
        unread: unreadCount > 0,
        unread_count: unreadCount,
      };
    });

    setOrders(merged);
    setLoading(false);
  };

  const createOrder = async () => {
    setErr("");

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    const title = newTitle.trim();
    const storeName = newStoreName.trim();
    const contactName = newContactName.trim();

    if (!title) {
      setErr("依頼案件名を入力してください");
      return;
    }

    setCreating(true);

    const { error } = await supabase.from("orders").insert({
      title,
      status: "進行中",
      store_name: storeName || null,
      contact_name: contactName || null,
      created_by_name: name,
    });

    setCreating(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setNewTitle("");
    setNewStoreName("");
    setNewContactName("");

    await load();
  };

  const toggleStatus = async (orderId: string, currentStatus: string) => {
    setErr("");

    const nextStatus = currentStatus === "納品済み" ? "進行中" : "納品済み";

    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      setErr(error.message);
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order
      )
    );
  };

  const logout = () => {
    localStorage.removeItem("user_name");
    router.push("/login");
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
        { event: "*", schema: "public", table: "orders" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_reads" },
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

  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 20000);

    return () => clearInterval(interval);
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
          maxWidth: 980,
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
          <div
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            ログイン中：{userName}
          </div>

          <button
            type="button"
            onClick={logout}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ログアウト
          </button>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: 20,
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 18,
              fontSize: "clamp(24px, 4vw, 32px)",
            }}
          >
            新規依頼作成
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="依頼案件名"
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
                fontSize: 15,
              }}
            />

            <input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="店舗名"
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
                fontSize: 15,
              }}
            />

            <input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="担当者名"
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
                fontSize: 15,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={createOrder}
              disabled={creating}
              style={{
                background: "#1a73e8",
                color: "white",
                border: "none",
                borderRadius: 999,
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? "作成中..." : "案件作成"}
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

          {err && (
            <p style={{ marginTop: 14, color: "tomato", marginBottom: 0 }}>
              エラー: {err}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(24px, 4vw, 20px)",
            }}
          >
            案件一覧 メッセージで詳細を入力してください
          </h2>
        </div>

        {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}

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
            gap: 14,
          }}
        >
          {orders.map((o) => {
            const isDone = o.status === "納品済み";

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
                    ? "1px solid rgba(59,130,246,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 24,
                  padding: 20,
                  boxShadow: o.unread
                    ? "0 8px 30px rgba(30,64,175,0.16)"
                    : "0 8px 30px rgba(0,0,0,0.20)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.55)",
                            marginBottom: 4,
                          }}
                        >
                          担当者名
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            wordBreak: "break-word",
                          }}
                        >
                          {o.contact_name || "未入力"}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.55)",
                            marginBottom: 4,
                          }}
                        >
                          依頼案件名
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            wordBreak: "break-word",
                          }}
                        >
                          {o.title}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.55)",
                            marginBottom: 4,
                          }}
                        >
                          店舗名
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            wordBreak: "break-word",
                          }}
                        >
                          {o.store_name || "未入力"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: "rgba(255,255,255,0.72)",
                      }}
                    >
                      最新メッセージ：
                      {o.latest_message_at
                        ? new Date(o.latest_message_at).toLocaleString()
                        : "まだありません"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleStatus(o.id, o.status);
                      }}
                      style={{
                        border: "none",
                        borderRadius: 999,
                        padding: "10px 14px",
                        fontWeight: 800,
                        cursor: "pointer",
                        background: isDone ? "#22c55e" : "#3b82f6",
                        color: "white",
                        whiteSpace: "nowrap",
                        boxShadow: isDone
                          ? "0 6px 16px rgba(34,197,94,0.25)"
                          : "0 6px 16px rgba(59,130,246,0.25)",
                      }}
                    >
                      {isDone ? "納品済み" : "進行中"}
                    </button>

                    {o.unread_count > 0 && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 28,
                          height: 28,
                          padding: o.unread_count >= 10 ? "0 8px" : "0 0",
                          borderRadius: 999,
                          background: "#ef4444",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 800,
                          boxShadow: "0 6px 16px rgba(239,68,68,0.35)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.unread_count > 99 ? "99+" : o.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
