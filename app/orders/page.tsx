"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  store_name: string | null;
  contact_name: string | null;
  designer_name: string | null;
  created_by_name: string | null;
  display_id: string | null;
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

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";
type SortMode = "新しい順" | "古い順" | "店舗名順";

type OrderWithMeta = OrderRow & {
  latest_message_at: string | null;
  unread: boolean;
  unread_count: number;
  display_status: DisplayStatus;
};

const DESIGNER_OPTIONS = ["", "吉本", "ハマダユカ"] as const;

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

  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"すべて" | DisplayStatus>("すべて");
  const [sortMode, setSortMode] = useState<SortMode>("新しい順");

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

  const getStatusColor = (displayStatus: DisplayStatus) => {
    if (displayStatus === "新規") {
      return {
        bg: "#f59e0b",
        text: "#ffffff",
        shadow: "0 6px 16px rgba(245,158,11,0.18)",
      };
    }

    if (displayStatus === "納品済み") {
      return {
        bg: "#22c55e",
        text: "#ffffff",
        shadow: "0 6px 16px rgba(34,197,94,0.16)",
      };
    }

    if (displayStatus === "アーカイブ") {
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

  const formatDate = (value: string | null) => {
    if (!value) return "まだありません";
    return new Date(value).toLocaleString("ja-JP");
  };

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
      .select(
        "id,title,status,created_at,store_name,contact_name,designer_name,created_by_name,display_id"
      )
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

    const messageMap = new Map<string, MessageRow[]>();
    for (const msg of messages) {
      const list = messageMap.get(msg.order_id) ?? [];
      list.push(msg);
      messageMap.set(msg.order_id, list);
    }

    const merged: OrderWithMeta[] = baseOrders.map((order) => {
      const latestMessage = latestMessageMap.get(order.id);
      const readInfo = readMap.get(order.id);
      const orderMessages = messageMap.get(order.id) ?? [];

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
        display_status: getDisplayStatus(order.status),
      };
    });

    setOrders(merged);
    setLoading(false);
  };

  const createOrder = async () => {
    setErr("");

    const params = new URLSearchParams(window.location.search);
    const urlLineUserId = params.get("line_user_id");
    const urlLineName = params.get("line_name");

    if (urlLineUserId) {
      localStorage.setItem("line_user_id", urlLineUserId);
    }

    if (urlLineName) {
      localStorage.setItem("user_name", urlLineName);
    }

    const name = localStorage.getItem("user_name") || urlLineName;
    const lineUserId = localStorage.getItem("line_user_id") || urlLineUserId;

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

    const { data: latestOrder, error: latestError } = await supabase
      .from("orders")
      .select("display_id")
      .not("display_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      setCreating(false);
      setErr(`表示ID取得エラー: ${latestError.message}`);
      return;
    }

    let nextNumber = 1001;

    if (latestOrder?.display_id) {
      const parsed = parseInt(latestOrder.display_id.replace("#", ""), 10);

      if (!Number.isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const displayId = `#${nextNumber}`;



    const { data, error } = await supabase
      .from("orders")
      .insert({
        title,
        status: "新規",
        store_name: storeName || null,
        contact_name: contactName || null,
        designer_name: null,
        created_by_name: name,
        created_by_line_user_id: lineUserId || null,
        line_user_id: lineUserId || null,
        display_id: displayId,
      })
      .select("id")
      .single();

    setCreating(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setNewTitle("");
    setNewStoreName("");
    setNewContactName("");

    router.push(`/orders/${data.id}`);
  };

  const updateOrderStatus = async (orderId: string, nextStatus: DisplayStatus) => {
    setErr("");

    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      setErr(`ステータス更新エラー: ${error.message}`);
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: nextStatus,
              display_status: nextStatus,
            }
          : order
      )
    );
  };

  const updateDesignerName = async (orderId: string, nextDesignerName: string) => {
    setErr("");

    const { error } = await supabase
      .from("orders")
      .update({
        designer_name: nextDesignerName || null,
      })
      .eq("id", orderId);

    if (error) {
      setErr(`担当デザイナー更新エラー: ${error.message}`);
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              designer_name: nextDesignerName || null,
            }
          : order
      )
    );
  };

  const logout = () => {
  localStorage.removeItem("user_name");
  localStorage.removeItem("line_user_id");
  router.push("/login");
};

useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  const urlLineUserId = params.get("line_user_id");
  const urlLineName = params.get("line_name");

  if (urlLineUserId) {
    localStorage.setItem("line_user_id", urlLineUserId);
  }

  if (urlLineName) {
    localStorage.setItem("user_name", urlLineName);
  }

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

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    const list = orders.filter((o) => {
      const matchesKeyword =
        !keyword ||
        (o.title ?? "").toLowerCase().includes(keyword) ||
        (o.store_name ?? "").toLowerCase().includes(keyword) ||
        (o.contact_name ?? "").toLowerCase().includes(keyword) ||
        (o.designer_name ?? "").toLowerCase().includes(keyword) ||
        (o.created_by_name ?? "").toLowerCase().includes(keyword) ||
        (o.display_id ?? "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "すべて" || o.display_status === statusFilter;

      return matchesKeyword && matchesStatus;
    });

    list.sort((a, b) => {
      if (sortMode === "古い順") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortMode === "店舗名順") {
        return (a.store_name ?? "").localeCompare(b.store_name ?? "", "ja");
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [orders, searchKeyword, statusFilter, sortMode]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 50%, #e8edf5 100%)",
        color: "#0f172a",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>
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
          <div style={{ fontSize: 15, color: "#475569", fontWeight: 600 }}>
            ログイン中：{userName}
          </div>

          <button
            type="button"
            onClick={logout}
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
            ログアウト
          </button>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 18,
              fontSize: "clamp(24px, 4vw, 32px)",
              color: "#0f172a",
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
                border: "1px solid #dbe2ea",
                background: "#f8fafc",
                color: "#334155",
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
                border: "1px solid #dbe2ea",
                background: "#f8fafc",
                color: "#334155",
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
                border: "1px solid #dbe2ea",
                background: "#f8fafc",
                color: "#334155",
                outline: "none",
                fontSize: 15,
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={createOrder}
              disabled={creating}
              style={{
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 16,
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
                opacity: creating ? 0.7 : 1,
                boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
              }}
            >
              {creating ? "作成中..." : "案件作成"}
            </button>

            <button
              type="button"
              onClick={load}
              style={{
                background: "#ffffff",
                color: "#334155",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              再読み込み
            </button>
          </div>

          {err && (
            <p style={{ marginTop: 14, color: "#dc2626", marginBottom: 0, fontSize: 14 }}>
              エラー: {err}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "clamp(24px, 4vw, 32px)", color: "#0f172a" }}>
            案件一覧
          </h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="検索（ID・店舗名・担当者・担当デザイナー・案件名）"
              style={{
                minWidth: 300,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #dbe2ea",
                background: "#f8fafc",
                color: "#334155",
                outline: "none",
                fontSize: 14,
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "すべて" | DisplayStatus)}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #dbe2ea",
                background: "#ffffff",
                color: "#334155",
                fontSize: 14,
                outline: "none",
              }}
            >
              <option value="すべて">すべて</option>
              <option value="新規">新規</option>
              <option value="進行中">進行中</option>
              <option value="納品済み">納品済み</option>
              <option value="アーカイブ">アーカイブ</option>
            </select>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #dbe2ea",
                background: "#ffffff",
                color: "#334155",
                fontSize: 14,
                outline: "none",
              }}
            >
              <option value="新しい順">新しい順</option>
              <option value="古い順">古い順</option>
              <option value="店舗名順">店舗名順</option>
            </select>
          </div>
        </div>

        {loading && <p style={{ marginTop: 16, color: "#475569" }}>読み込み中...</p>}

        {!loading && filteredOrders.length === 0 && (
          <div
            style={{
              marginTop: 18,
              padding: 24,
              borderRadius: 20,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#64748b",
              boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
            }}
          >
            条件に合う案件がありません
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredOrders.map((o) => {
            const statusStyle = getStatusColor(o.display_status);

            return (
              <div
                key={o.id}
                onClick={() => router.push(`/orders/${o.id}`)}
                style={{
                  display: "block",
                  color: "#0f172a",
                  background: "#ffffff",
                  border: o.unread
                    ? "1px solid rgba(59,130,246,0.32)"
                    : "1px solid #e5e7eb",
                  borderRadius: 40,
                  padding: "24px 24px 20px",
                  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                {o.unread && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 18,
                      bottom: 18,
                      width: 4,
                      borderRadius: "0 999px 999px 0",
                      background: "#3b82f6",
                    }}
                  />
                )}

                <div className="orderCardTop">
                  <div className="orderCardMain">
                    <div className="orderTopGrid">
                      <div style={{ minWidth: 0 }}>
                        <div className="orderLabel">依頼案件名</div>
                        <div className="orderValue">{o.title || "未入力"}</div>
                      </div>

                      <div className="orderDividerBlock">
                        <div className="orderLabel">使用店舗名</div>
                        <div className="orderValue">{o.store_name || "未入力"}</div>
                      </div>

                      <div className="orderDividerBlock">
                        <div className="orderLabel">依頼者名</div>
                        <div className="orderValue">{o.contact_name || "未入力"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="orderStatusWrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();

                        const nextStatus: DisplayStatus =
                          o.display_status === "新規"
                            ? "進行中"
                            : o.display_status === "進行中"
                            ? "納品済み"
                            : o.display_status === "納品済み"
                            ? "アーカイブ"
                            : "進行中";

                        updateOrderStatus(o.id, nextStatus);
                      }}
                      style={{
                        minWidth: 118,
                        height: 48,
                        border: "none",
                        borderRadius: 999,
                        padding: "0 18px",
                        fontWeight: 900,
                        fontSize: 14,
                        cursor: "pointer",
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        whiteSpace: "nowrap",
                        boxShadow: statusStyle.shadow,
                      }}
                      title="クリックで状態切り替え"
                    >
                      {o.display_status}
                    </button>
                  </div>
                </div>

                <div className="orderBottomRow">
                  <div className="orderBottomLeft">
                    <div className="orderIdText">オーダーID:{o.display_id || "未採番"}</div>
                    <div className="orderMetaText">
                      最新メッセージ：{formatDate(o.latest_message_at)}
                    </div>
                    <div className="orderMetaText">
                      作成者：{o.created_by_name || "不明"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        color: "#64748b",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      担当デザイナー
                    </div>

                    <select
                      value={o.designer_name || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateDesignerName(o.id, e.target.value);
                      }}
                      style={{
                        width: 220,
                        maxWidth: "100%",
                        height: 30,
                        padding: "0 14px",
                        borderRadius: 999,
                        border: "1.5px solid #d1d5db",
                        background: "#ffffff",
                        color: "#0f172a",
                        outline: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    >
                      {DESIGNER_OPTIONS.map((name) => (
                        <option key={name || "empty"} value={name}>
                          {name || "未設定"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {o.unread_count > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 26,
                      height: 26,
                      padding: o.unread_count >= 10 ? "0 8px" : "0 0",
                      borderRadius: 999,
                      background: "#ef4444",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      boxShadow: "0 6px 16px rgba(239,68,68,0.28)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.unread_count > 99 ? "99+" : o.unread_count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        input:focus,
        select:focus {
          border-color: #94a3b8 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.12);
        }

        button:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.2s ease;
        }

        .orderCardTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          padding-bottom: 14px;
          border-bottom: 1.5px solid #94a3b8;
        }

        .orderCardMain {
          min-width: 0;
          flex: 1;
        }

        .orderTopGrid {
          display: grid;
          grid-template-columns: 1.5fr 0.8fr 0.8fr;
          gap: 18px;
          align-items: start;
        }

        .orderDividerBlock {
          min-width: 0;
          padding-left: 18px;
          border-left: 1.5px solid #94a3b8;
        }

        .orderLabel {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .orderValue {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          line-height: 1.35;
          word-break: break-word;
        }

        .orderStatusWrap {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          flex-shrink: 0;
        }

        .orderBottomRow {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .orderBottomLeft {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          min-width: 0;
        }

        .orderIdText {
          font-size: 15px;
          font-weight: 900;
          color: #64748b;
          letter-spacing: 0.01em;
          word-break: break-word;
        }

        .orderMetaText {
          font-size: 13px;
          color: #64748b;
          font-weight: 700;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .orderCardTop {
            flex-direction: column;
            align-items: stretch;
          }

          .orderTopGrid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .orderDividerBlock {
            padding-left: 0;
            border-left: none;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
          }

          .orderStatusWrap {
            justify-content: flex-start;
          }

          .orderBottomRow {
            flex-direction: column;
            align-items: flex-start;
          }

          .orderBottomLeft {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .orderMetaText {
            white-space: normal;
            word-break: break-word;
          }
        }

        @media (max-width: 560px) {
          .orderValue {
            font-size: 14px;
          }

          .orderIdText {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
