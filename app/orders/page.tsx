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

  // ======================
  // データ取得
  // ======================
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

    const baseOrders = (orderData ?? []) as OrderRow;
    const orderIds = baseOrders.map((o) => o.id);

    const { data: messageData } = await supabase
      .from("messages")
      .select("order_id,created_at,sender_name")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    const { data: readData } = await supabase
      .from("order_reads")
      .select("order_id,last_read_at")
      .eq("user_name", name)
      .in("order_id", orderIds);

    const latestMap = new Map();
    messageData?.forEach((m) => {
      if (!latestMap.has(m.order_id)) {
        latestMap.set(m.order_id, m);
      }
    });

    const readMap = new Map();
    readData?.forEach((r) => readMap.set(r.order_id, r));

    const merged = baseOrders.map((o) => {
      const latest = latestMap.get(o.id);
      const read = readMap.get(o.id);

      const unread =
        latest &&
        latest.sender_name !== name &&
        (!read ||
          new Date(latest.created_at) > new Date(read.last_read_at));

      return {
        ...o,
        latest_message_at: latest?.created_at ?? null,
        unread,
      };
    });

    setOrders(merged);
    setLoading(false);
  };

  // ======================
  // 新規作成
  // ======================
  const createOrder = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    if (!newTitle.trim()) {
      setErr("案件名を入力して");
      return;
    }

    setCreating(true);

    await supabase.from("orders").insert({
      title: newTitle,
      status: "進行中",
      store_name: newStoreName,
      contact_name: newContactName,
      created_by_name: name,
    });

    setNewTitle("");
    setNewStoreName("");
    setNewContactName("");
    setCreating(false);
  };

  // ======================
  // ステータス切替
  // ======================
  const toggleStatus = async (id: string, status: string) => {
    const next = status === "納品済み" ? "進行中" : "納品済み";

    await supabase.from("orders").update({ status: next }).eq("id", id);

    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: next } : o))
    );
  };

  // ======================
  // ログアウト
  // ======================
  const logout = () => {
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  // 初回ロード
  useEffect(() => {
    load();
  }, []);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_reads" }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ======================
  // ★ 20秒自動更新
  // ======================
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // ======================
  // UI
  // ======================
  return (
    <div style={{ padding: 20, color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <p>ログイン中：{userName}</p>
        <button onClick={logout}>ログアウト</button>
      </div>

      <h2>新規依頼作成</h2>

      <input
        placeholder="依頼案件名"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
      />
      <input
        placeholder="店舗名"
        value={newStoreName}
        onChange={(e) => setNewStoreName(e.target.value)}
      />
      <input
        placeholder="担当者名"
        value={newContactName}
        onChange={(e) => setNewContactName(e.target.value)}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={createOrder}>
          {creating ? "作成中..." : "案件作成"}
        </button>
        <button onClick={load}>再読み込み</button>
      </div>

      <h2 style={{ marginTop: 30 }}>案件一覧</h2>

      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            border: "1px solid gray",
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div>担当者：{o.contact_name}</div>
              <div>案件：{o.title}</div>
              <div>店舗：{o.store_name}</div>
            </div>

            <button onClick={() => toggleStatus(o.id, o.status)}>
              {o.status}
            </button>
          </div>

          <div style={{ marginTop: 6 }}>
            最新メッセージ：
            {o.latest_message_at
              ? new Date(o.latest_message_at).toLocaleString()
              : "なし"}
          </div>

          {o.unread && (
            <div style={{ color: "red", fontWeight: "bold" }}>
              未読あり
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
