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

type MonthlyGroup = {
  month: string;
  orders: OrderWithMeta[];
  unreadCount: number;
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
  const [statusFilter, setStatusFilter] =
    useState<"すべて" | DisplayStatus>("すべて");
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

  const getOrderMonth = (createdAt: string | null) => {
    if (!createdAt) return "月未設定";
    return String(createdAt).slice(0, 7);
  };

const load = async () => {
  const name = localStorage.getItem("user_name");
  const lineUserId = localStorage.getItem("line_user_id");

  if (!name) {
    router.push("/login");
    return;
  }

  setUserName(name);
  setErr("");
  setLoading(true);

  let role = "creator";

const { data: userData } = await supabase
  .from("line_users")
  .select("role")
  .or(
    lineUserId
      ? `line_user_id.eq.${lineUserId},line_name.eq.${name}`
      : `line_name.eq.${name}`
  )
  .maybeSingle();

role = userData?.role || "creator";
localStorage.setItem("role", role);

  
  let orderQuery = supabase
    .from("orders")
    .select(
      "id,title,status,created_at,store_name,contact_name,designer_name,created_by_name,display_id,line_user_id,created_by_line_user_id"
    )
    .order("created_at", { ascending: false });

  if (role === "creator") {
    orderQuery = orderQuery.eq("line_user_id", lineUserId);
  }

  const { data: orderData, error: orderError } = await orderQuery;

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
      unreadCount = orderMessages.filter(
        (msg) => msg.sender_name !== name
      ).length;
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

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: DisplayStatus
  ) => {
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

  const updateDesignerName = async (
    orderId: string,
    nextDesignerName: string
  ) => {
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => load()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      () => load()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_reads" },
      () => load()
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
    }, 300000);

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
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      }

      if (sortMode === "店舗名順") {
        return (a.store_name ?? "").localeCompare(b.store_name ?? "", "ja");
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

    return list;
  }, [orders, searchKeyword, statusFilter, sortMode]);

  const monthlyGroups = useMemo<MonthlyGroup[]>(() => {
    const map = new Map<string, OrderWithMeta[]>();

    for (const order of filteredOrders) {
      const month = getOrderMonth(order.created_at);
      const list = map.get(month) ?? [];
      list.push(order);
      map.set(month, list);
    }

    return Array.from(map.entries())
      .map(([month, groupOrders]) => ({
        month,
        orders: groupOrders,
        unreadCount: groupOrders.reduce(
          (sum, order) => sum + order.unread_count,
          0
        ),
      }))
      .sort((a, b) => {
        if (sortMode === "古い順") return a.month.localeCompare(b.month);
        return b.month.localeCompare(a.month);
      });
  }, [filteredOrders, sortMode]);

  const renderOrderCard = (o: OrderWithMeta) => {
    const statusStyle = getStatusColor(o.display_status);

    return (
      <article
        key={o.id}
        className={`orderCard ${o.unread ? "isUnread" : ""}`}
        onClick={() => router.push(`/orders/${o.id}`)}
      >
        {o.unread_count > 0 && (
          <div className="unreadRibbon">
            新着 {o.unread_count > 99 ? "99+" : o.unread_count}件
          </div>
        )}

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
            {o.unread_count > 0 ? "新着を確認する" : "案件を確認する"}
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
              onClick={() =>
                updateOrderStatus(o.id, getNextStatus(o.display_status))
              }
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
  };

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
  <div className="createHead">
    <div>
      <p className="createKicker">NEW ORDER</p>
      <h2>新規依頼作成</h2>
    </div>

    <button type="button" onClick={load} className="reloadBtn">
      再読み込み
    </button>
  </div>

  <div className="createGrid">
    <label className="createField mainField">
      <span>案件名</span>
      <input
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="例）イベントスライド一式"
      />
    </label>

    <label className="createField">
      <span>店舗名</span>
      <input
        value={newStoreName}
        onChange={(e) => setNewStoreName(e.target.value)}
        placeholder="例）金妻"
      />
    </label>

    <label className="createField">
      <span>担当者名</span>
      <input
        value={newContactName}
        onChange={(e) => setNewContactName(e.target.value)}
        placeholder="例）山田"
      />
    </label>

    <button
      type="button"
      onClick={createOrder}
      disabled={creating}
      className="createBtn"
    >
      <span>{creating ? "作成中..." : "案件を作成する"}</span>
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
              onChange={(e) =>
                setStatusFilter(e.target.value as "すべて" | DisplayStatus)
              }
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
            >
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

        {!loading && filteredOrders.length > 0 && (
          <section className="monthAccordionList">
            {monthlyGroups.map((group, index) => {
              const newCount = group.orders.filter(
                (o) => o.display_status === "新規"
              ).length;
              const progressCount = group.orders.filter(
                (o) => o.display_status === "進行中"
              ).length;
              const doneCount = group.orders.filter(
                (o) => o.display_status === "納品済み"
              ).length;

              return (
                <details
                  key={group.month}
                  className={`monthAccordion ${
                    group.unreadCount > 0 ? "hasUnread" : ""
                  }`}
                  open={index === 0 || group.unreadCount > 0}
                >
                  <summary className="monthAccordionHead">
                    <div className="monthTitleArea">
                      <span className="monthArrow">▶</span>
                      <span className="monthTitle">{group.month}</span>

                      {group.unreadCount > 0 && (
                        <span className="monthUnreadBadge">
                          新着 {group.unreadCount > 99 ? "99+" : group.unreadCount}
                          件
                        </span>
                      )}
                    </div>

                    <div className="monthStats">
                      <span>{group.orders.length}件</span>
                      <span>新規 {newCount}</span>
                      <span>進行中 {progressCount}</span>
                      <span>納品済み {doneCount}</span>
                    </div>
                  </summary>

                  <div className="monthAccordionBody">
                    {group.orders.map((o) => renderOrderCard(o))}
                  </div>
                </details>
              );
            })}
          </section>
        )}

        <footer className="footer">© 2026 1best Order System</footer>
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
  background:
    linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
  border: 1px solid #e5e7eb;
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  margin-bottom: 28px;
}

.createHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}



.createBox h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: 0.02em;
}

.createGrid {
  display: grid;
  grid-template-columns: 1.25fr 1fr 0.9fr 180px;
  gap: 12px;
  align-items: end;
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

.createField {
  display: grid;
  gap: 7px;
}

.createField span {
  color: #475569;
  font-size: 12px;
  font-weight: 900;
}

.createField input {
  height: 48px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #ffffff;
  color: #0f172a;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
  box-sizing: border-box;
}

.createField input::placeholder {
  color: #94a3b8;
  font-weight: 600;
}

.createField input:focus {
  border-color: #071426;
  box-shadow: 0 0 0 4px rgba(7, 20, 38, 0.08);
}

        .createBtn {
  height: 48px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #35b269, #3cb48c);
  color: #fff;
  font-size: 14px;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(7, 20, 38, 0.18);
}

.createBtn:disabled {
  opacity: 0.65;
  cursor: default;
}

.reloadBtn {
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

@media (max-width: 980px) {
  .createGrid {
    grid-template-columns: 1fr;
  }

  .createHead {
    align-items: flex-start;
  }

  .createBtn {
    width: 100%;
  }
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

        .monthAccordionList {
          display: grid;
          gap: 14px;
        }

        .monthAccordion {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #fff;
          overflow: visible;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .monthAccordion.hasUnread {
          border-color: rgba(239, 68, 68, 0.55);
          box-shadow: 0 16px 42px rgba(239, 68, 68, 0.16);
        }

        .monthAccordionHead {
          list-style: none;
          cursor: pointer;
          padding: 18px 22px;
          background: #1e2c3d;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          border-radius: 18px;
        }

        .monthAccordion.hasUnread .monthAccordionHead {
          background: linear-gradient(90deg, #7f1d1d 0%, #1e2c3d 58%);
        }

        .monthAccordion[open] .monthAccordionHead {
          border-radius: 18px 18px 0 0;
        }

        .monthAccordionHead::-webkit-details-marker {
          display: none;
        }

        .monthTitleArea {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .monthArrow {
          font-size: 12px;
          transform: rotate(0deg);
          transition: 0.2s ease;
        }

        .monthAccordion[open] .monthArrow {
          transform: rotate(90deg);
        }

        .monthTitle {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .monthUnreadBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 0 13px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 13px;
          font-weight: 950;
          white-space: nowrap;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
        }

        .monthStats {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 12px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.86);
        }

        .monthStats span {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
        }

        :global(.monthAccordionBody) {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 0 0 18px 18px;
        }

        :global(.orderCard) {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
          align-items: center;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 24px 28px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
          cursor: pointer;
          overflow: visible;
        }

        :global(.orderCard.isUnread) {
          border: 2px solid rgba(239, 68, 68, 0.75);
          box-shadow: 0 16px 42px rgba(239, 68, 68, 0.18);
          background: linear-gradient(90deg, #fff5f5 0%, #ffffff 30%);
        }

        :global(.orderCard.isUnread::before) {
          content: "";
          position: absolute;
          left: 0;
          top: 14px;
          bottom: 14px;
          width: 7px;
          border-radius: 0 999px 999px 0;
          background: #ef4444;
        }

        :global(.infoArea) {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          column-gap: 42px;
          row-gap: 18px;
          min-width: 0;
        }

        :global(.label) {
          font-size: 11px;
          font-weight: 900;
          color: #64748b;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }

        :global(.mainTitle),
        :global(.storeTitle) {
          font-size: 18px;
          font-weight: 800;
          line-height: 1.45;
          color: #241915;
          word-break: break-word;
        }

        :global(.metaLine) {
          grid-column: 1 / -1;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.7;
          padding-top: 2px;
        }

        :global(.actionArea) {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        :global(.confirmBtn) {
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

        :global(.orderCard.isUnread .confirmBtn) {
          background: #ef4444;
          box-shadow: 0 12px 28px rgba(239, 68, 68, 0.24);
        }

        :global(.adminControls) {
          display: grid;
          grid-template-columns: auto 1fr 82px;
          gap: 7px;
          align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 5px 7px 5px 10px;
          background: #fff;
        }

        :global(.designerText) {
          color: #6b7280;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        :global(.designerSelect) {
          height: 26px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          padding: 0 8px;
          border: 1px solid #d1d5db;
        }

        :global(.statusBtn) {
          height: 26px;
          border: none;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        :global(.unreadBadge) {
          position: absolute;
          top: -14px;
          right: -14px;
          min-width: 42px;
          height: 42px;
          padding: 0 9px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 17px;
          font-weight: 950;
          box-sizing: border-box;
          box-shadow: 0 0 0 5px #fff, 0 12px 24px rgba(239, 68, 68, 0.35);
          z-index: 5;
        }

        :global(.unreadRibbon) {
          position: absolute;
          top: 14px;
          left: 18px;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 12px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.28);
          z-index: 4;
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

          .monthAccordionHead {
            align-items: flex-start;
            flex-direction: column;
          }

          .monthStats {
            justify-content: flex-start;
          }

          :global(.orderCard) {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          :global(.infoArea) {
            grid-template-columns: 1fr 1fr;
            column-gap: 16px;
            row-gap: 12px;
          }

          :global(.mainTitle),
          :global(.storeTitle) {
            font-size: 16px;
          }

          :global(.confirmBtn) {
            height: 44px;
            font-size: 15px;
          }

          :global(.adminControls) {
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
    font-weight: 700;
  }

  .logoutBtn {
    padding: 8px 12px;
    font-size: 11px;
  }

  .createBox {
    padding: 16px;
    border-radius: 18px;
    margin-bottom: 18px;
  }

  .createHead {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
  }

  .createKicker {
    margin: 0 0 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  .createBox h2 {
    font-size: 19px;
    font-weight: 800;
  }

  .reloadBtn {
    width: auto;
    height: 34px;
    padding: 0 13px;
    font-size: 11px;
    font-weight: 700;
  }

  .createGrid {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 0;
  }

  .createField {
    gap: 6px;
  }

  .createField span {
    font-size: 11px;
    font-weight: 700;
  }

  .createField input,
  input,
  select {
    height: 42px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
  }

  .createBtn {
    width: 100%;
    height: 44px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    background: linear-gradient(135deg, #35b269, #3cb48c);
  }

  .errorText {
    font-size: 12px;
  }

  .listHead {
    gap: 10px;
    margin-bottom: 10px;
  }

  .listHead h2 {
    font-size: 19px;
    font-weight: 800;
  }

  .filters {
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
  }

  .filters input,
  .filters select {
    height: 38px;
    font-size: 12px;
    font-weight: 500;
  }

  .monthAccordion {
    border-radius: 14px;
  }

  .monthAccordionHead {
    padding: 13px 14px;
    border-radius: 14px;
    gap: 10px;
  }

  .monthAccordion[open] .monthAccordionHead {
    border-radius: 14px 14px 0 0;
  }

  .monthTitle {
    font-size: 16px;
    font-weight: 800;
  }

  .monthUnreadBadge {
    min-height: 24px;
    font-size: 10px;
    padding: 0 9px;
  }

  .monthStats {
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
  }

  .monthStats span {
    height: 23px;
    padding: 0 8px;
  }

  :global(.monthAccordionBody) {
    padding: 10px;
    border-radius: 0 0 14px 14px;
  }

  :global(.orderCard) {
    grid-template-columns: 1fr;
    padding: 16px 14px;
    border-radius: 15px;
    gap: 12px;
  }

  :global(.infoArea) {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  :global(.label) {
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  :global(.mainTitle),
  :global(.storeTitle) {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.45;
  }

  :global(.metaLine) {
    gap: 8px;
    font-size: 10px;
    font-weight: 500;
    line-height: 1.5;
  }

  :global(.actionArea) {
    gap: 7px;
  }

  :global(.confirmBtn) {
    height: 40px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
  }

  :global(.adminControls) {
    grid-template-columns: 1fr;
    border-radius: 14px;
    padding: 8px;
    gap: 6px;
  }

  :global(.designerText) {
    font-size: 10px;
    font-weight: 600;
  }

  :global(.designerSelect),
  :global(.statusBtn) {
    width: 100%;
    height: 30px;
    font-size: 11px;
    font-weight: 700;
  }

  :global(.unreadBadge) {
    top: -8px;
    right: -8px;
    min-width: 30px;
    height: 30px;
    font-size: 13px;
    box-shadow: 0 0 0 4px #fff, 0 8px 18px rgba(239, 68, 68, 0.32);
  }

  :global(.unreadRibbon) {
    top: 8px;
    left: 12px;
    min-height: 22px;
    padding: 0 9px;
    font-size: 10px;
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
