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
    if (displayStatus === "新規") return { bg: "#f59e0b", text: "#fff" };
    if (displayStatus === "納品済み") return { bg: "#22c55e", text: "#fff" };
    if (displayStatus === "アーカイブ") return { bg: "#6b7280", text: "#fff" };
    return { bg: "#3b82f6", text: "#fff" };
  };

  const getNextStatus = (current: DisplayStatus): DisplayStatus => {
    if (current === "新規") return "進行中";
    if (current === "進行中") return "納品済み";
    if (current === "納品済み") return "アーカイブ";
    return "進行中";
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

    if (urlLineUserId) localStorage.setItem("line_user_id", urlLineUserId);
    if (urlLineName) localStorage.setItem("user_name", urlLineName);

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
      if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
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

    await fetch("/api/line/order-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId,
        displayId,
        title,
        storeName,
        contactName,
        orderUrl: `https://app.1best.info/orders/${data.id}`,
      }),
    });

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
          ? { ...order, status: nextStatus, display_status: nextStatus }
          : order
      )
    );
  };

  const updateDesignerName = async (orderId: string, nextDesignerName: string) => {
    setErr("");

    const { error } = await supabase
      .from("orders")
      .update({ designer_name: nextDesignerName || null })
      .eq("id", orderId);

    if (error) {
      setErr(`担当デザイナー更新エラー: ${error.message}`);
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? { ...order, designer_name: nextDesignerName || null }
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

    if (urlLineUserId) localStorage.setItem("line_user_id", urlLineUserId);
    if (urlLineName) localStorage.setItem("user_name", urlLineName);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_reads" }, () => {
        load();
      })
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
    <div className="page">
      <div className="wrap">
        <header className="topHeader">
          <div className="loginText">ログイン中：{userName}</div>

          <button type="button" onClick={logout} className="logoutBtn">
            ログアウト
          </button>
        </header>

        <section className="createBox">
          <h2>新規依頼作成</h2>

          <div className="createGrid">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="依頼案件名（必須）"
            />
            <input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="店舗名"
            />
            <input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="担当者名"
            />

            <button type="button" onClick={createOrder} disabled={creating} className="createBtn">
              {creating ? "作成中..." : "案件作成"}
            </button>

            <button type="button" onClick={load} className="reloadBtn">
              再読み込み
            </button>
          </div>

          {err && <p className="errorText">エラー: {err}</p>}
        </section>

        <section className="listHead">
          <h2>案件一覧</h2>

          <div className="filters">
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="検索（ID・店舗名・担当者・案件名・担当デザイナー）"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "すべて" | DisplayStatus)}
            >
              <option value="すべて">すべて</option>
              <option value="新規">新規</option>
              <option value="進行中">進行中</option>
              <option value="納品済み">納品済み</option>
              <option value="アーカイブ">アーカイブ</option>
            </select>

            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="新しい順">新しい順</option>
              <option value="古い順">古い順</option>
              <option value="店舗名順">店舗名順</option>
            </select>
          </div>
        </section>

        {loading && <p className="loadingText">読み込み中...</p>}

        {!loading && filteredOrders.length === 0 && (
          <div className="emptyBox">条件に合う案件がありません</div>
        )}

        <section className="orderList">
          {filteredOrders.map((o) => {
            const statusStyle = getStatusColor(o.display_status);

            return (
              <article
                key={o.id}
                className={`orderCard ${o.unread ? "isUnread" : ""}`}
                onClick={() => router.push(`/orders/${o.id}`)}
              >
                <div className="infoArea">
                  <div>
                    <div className="label">依頼案件名</div>
                    <div className="mainTitle">{o.title || "未入力"}</div>
                  </div>

                  <div>
                    <div className="label">使用店舗名</div>
                    <div className="storeTitle">{o.store_name || "未入力"}</div>
                  </div>

                  <div className="metaLine">
                    <span>オーダーID:{o.display_id || "未採番"}</span>
                    <span>依頼者名:{o.contact_name || "未入力"}</span>
                    <span>作成者:{o.created_by_name || "不明"}</span>
                    <span>最新:{formatDate(o.latest_message_at)}</span>
                  </div>
                </div>

                <div className="actionArea" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="confirmBtn"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    案件を確認する
                  </button>

                  <div className="adminControls">
                    <span className="designerText">担当デザイナー</span>

                    <select
                      value={o.designer_name || ""}
                      onChange={(e) => updateDesignerName(o.id, e.target.value)}
                      className="designerSelect"
                    >
                      {DESIGNER_OPTIONS.map((name) => (
                        <option key={name || "empty"} value={name}>
                          {name || "未設定"}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="statusBtn"
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.text,
                      }}
                      onClick={() => updateOrderStatus(o.id, getNextStatus(o.display_status))}
                    >
                      {o.display_status}
                    </button>
                  </div>
                </div>

                {o.unread_count > 0 && (
                  <div className="unreadBadge">
                    {o.unread_count > 99 ? "99+" : o.unread_count}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="footer">© 2024 Order Management System</footer>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
          color: #0f172a;
          padding: 24px;
          box-sizing: border-box;
        }

        .wrap {
          max-width: 1180px;
          margin: 0 auto;
        }

        .topHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .loginText {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
        }

        .logoutBtn,
        .reloadBtn {
          background: #fff;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .createBox {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.07);
          margin-bottom: 24px;
        }

        .createBox h2,
        .listHead h2 {
          margin: 0;
          font-size: 22px;
          line-height: 1.3;
        }

        .createGrid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr 140px 130px;
          gap: 10px;
          align-items: center;
        }

        input,
        select {
          width: 100%;
          height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #fff;
          color: #0f172a;
          padding: 0 12px;
          font-size: 13px;
          box-sizing: border-box;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.15);
        }

        .createBtn {
          height: 40px;
          border: none;
          border-radius: 12px;
          background: #071426;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .errorText {
          color: #ef4444;
          font-size: 13px;
          font-weight: 700;
          margin: 12px 0 0;
        }

        .listHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 400px) 130px 130px;
          gap: 10px;
        }

        .orderList {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .orderCard {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 22px;
          align-items: center;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px 20px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          cursor: pointer;
        }

        .orderCard.isUnread {
          border-color: rgba(59, 130, 246, 0.45);
        }

        .infoArea {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          column-gap: 30px;
          row-gap: 14px;
          min-width: 0;
        }

        .label {
          font-size: 11px;
          font-weight: 900;
          color: #64748b;
          margin-bottom: 5px;
        }

        .mainTitle,
        .storeTitle {
          font-size: 18px;
          font-weight: 800;
          line-height: 1.4;
          color: #241915;
          word-break: break-word;
        }

        .metaLine {
          grid-column: 1 / -1;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.5;
        }

        .actionArea {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .confirmBtn {
          height: 50px;
          border: none;
          border-radius: 12px;
          background: #1f130f;
          color: #fff;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(31, 19, 15, 0.16);
        }

        .adminControls {
          display: grid;
          grid-template-columns: auto 1fr 82px;
          gap: 7px;
          align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 5px 7px 5px 10px;
          background: #fff;
        }

        .designerText {
          color: #6b7280;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .designerSelect {
          height: 26px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          padding: 0 8px;
          border: 1px solid #d1d5db;
        }

        .statusBtn {
          height: 26px;
          border: none;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .unreadBadge {
          position: absolute;
          top: -10px;
          right: -10px;
          min-width: 36px;
          height: 36px;
          padding: 0 8px;
          border-radius: 999px;
          background: #ff0000;
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 16px;
          font-weight: 900;
          box-sizing: border-box;
        }

        .emptyBox,
        .loadingText {
          background: #fff;
          border-radius: 14px;
          padding: 18px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .footer {
          text-align: center;
          margin-top: 20px;
          color: #64748b;
          font-size: 11px;
        }

        button:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.18s ease;
        }

        @media (max-width: 980px) {
          .createGrid {
            grid-template-columns: 1fr;
          }

          .listHead {
            align-items: stretch;
            flex-direction: column;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .orderCard {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .infoArea {
            grid-template-columns: 1fr 1fr;
            column-gap: 16px;
            row-gap: 12px;
          }

          .mainTitle,
          .storeTitle {
            font-size: 16px;
          }

          .confirmBtn {
            height: 44px;
            font-size: 15px;
          }

          .adminControls {
            grid-template-columns: auto 1fr 76px;
          }
        }

        @media (max-width: 560px) {
          .page {
            padding: 10px;
          }

          .topHeader {
            margin-bottom: 10px;
          }

          .loginText {
            font-size: 12px;
          }

          .logoutBtn {
            padding: 8px 12px;
            font-size: 11px;
          }

          .createBox {
            display: block;
            padding: 14px;
            border-radius: 14px;
            margin-bottom: 16px;
          }

          .createBox h2 {
            font-size: 18px;
          }

          .createGrid {
            grid-template-columns: 1fr;
            gap: 8px;
            margin-top: 10px;
          }

          input,
          select {
            height: 38px;
            font-size: 12px;
          }

          .createBtn,
          .reloadBtn {
            width: 100%;
            height: 38px;
            font-size: 12px;
          }

          .errorText {
            font-size: 12px;
          }

          .listHead h2 {
            font-size: 18px;
          }

          .filters {
            display: none;
          }

          .orderCard {
            grid-template-columns: 1fr;
            padding: 14px;
            border-radius: 14px;
            gap: 10px;
          }

          .infoArea {
            grid-template-columns: 1fr 1fr;
            column-gap: 10px;
            row-gap: 8px;
          }

          .label {
            font-size: 10px;
            margin-bottom: 4px;
          }

          .mainTitle,
          .storeTitle {
            font-size: 15px;
            line-height: 1.35;
          }

          .metaLine {
            gap: 6px;
            font-size: 10px;
            line-height: 1.5;
          }

          .actionArea {
            gap: 6px;
          }

          .confirmBtn {
            height: 40px;
            border-radius: 10px;
            font-size: 14px;
            letter-spacing: 0.01em;
          }

          .adminControls {
            grid-template-columns: auto 1fr 64px;
            gap: 6px;
            padding: 5px 6px 5px 8px;
            border-radius: 999px;
          }

          .designerText {
            font-size: 9px;
          }

          .designerSelect {
            height: 24px;
            font-size: 9px;
            padding: 0 8px;
          }

          .statusBtn {
            height: 24px;
            font-size: 9px;
          }

          .unreadBadge {
            top: -6px;
            right: -6px;
            min-width: 26px;
            height: 26px;
            font-size: 12px;
          }

          .footer {
            font-size: 10px;
            margin-top: 16px;
          }
        }
      `}</style>
    </div>
  );
}
