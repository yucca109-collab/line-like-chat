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

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    setUserName(profile?.display_name || user.email || "");

    const { data, error } = await supabase
      .from("orders")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    else setOrders((data ?? []) as OrderRow[]);

    setLoading(false);
  };

  const createDummy = async () => {
    setErr("");
    const title = `テスト案件 ${new Date().toLocaleString()}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user?.id)
      .maybeSingle();

    const { error } = await supabase.from("orders").insert({
      title,
      status: "new",
      created_by: user?.id ?? null,
      created_by_name: profile?.display_name ?? null,
    });

    if (error) setErr(error.message);
    else load();
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push("/login");
        return;
      }

      const pendingName = localStorage.getItem("pending_display_name");

      if (pendingName) {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          display_name: pendingName,
        });

        localStorage.removeItem("pending_display_name");
      }

      await load();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>案件一覧</h1>
      <p>ログイン中: {userName}</p>

      <OrderCreateForm onCreated={load} />

      <div style={{ marginTop: 16 }}>
        <button onClick={createDummy}>＋ テスト案件を追加</button>
        <button onClick={load} style={{ marginLeft: 8 }}>
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
