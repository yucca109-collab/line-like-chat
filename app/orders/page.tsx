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

export default function OrdersPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
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

    const { data, error } = await supabase
      .from("orders")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
    } else {
      setOrders((data ?? []) as OrderRow[]);
    }

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

  return (
    <div style={{ padding: 40 }}>
      <h1>案件一覧</h1>
      <p>ログイン中: {userName}</p>

      <OrderCreateForm onCreated={load} />

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={createDummy}>
          ＋ テスト案件を追加
        </button>
        <button type="button" onClick={load} style={{ marginLeft: 8 }}>
          再読み込み
        </button>
      </div>

      {loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
      {err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        {orders.map((o) => (
          <li key={o.id}>
            <a href={`/orders/${o.id}`} style={{ textDecoration: "underline" }}>
              <strong>{o.title}</strong>（{o.status}）{" "}
              <small>{new Date(o.created_at).toLocaleString()}</small>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
