"use client";

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
};

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";

export default function OrdersPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const load = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    setUserName(name);
    setLoading(true);

    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    setOrders(data || []);
    setLoading(false);
  };

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: DisplayStatus
  ) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      return;
    }

    await load(); // ← これ重要（DBと完全同期）
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 50%, #e8edf5 100%)",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ color: "#334155", fontWeight: 600 }}>
            {userName}
          </div>

          <button
            onClick={() => router.push("/login")}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              padding: "8px 14px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ログアウト
          </button>
        </div>

        {/* カード */}
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ marginBottom: 20 }}>案件一覧</h2>

          {loading && <p>読み込み中...</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {orders.map((o) => {
              const status = getDisplayStatus(o.status);

              return (
                <div
                  key={o.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 18,
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    cursor: "pointer",
                  }}
                  onClick={() => router.push(`/orders/${o.id}`)}
                >
                  <div>
                    <div style={{ fontSize: 14, color: "#64748b" }}>
                      {o.store_name}
                    </div>

                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {o.title}
                    </div>

                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      {o.contact_name}
                    </div>
                  </div>

                  {/* ステータス */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      const next =
                        status === "新規"
                          ? "進行中"
                          : status === "進行中"
                          ? "納品済み"
                          : status === "納品済み"
                          ? "アーカイブ"
                          : "進行中";

                      updateOrderStatus(o.id, next);
                    }}
                    style={{
                      borderRadius: 999,
                      padding: "10px 14px",
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {status}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
