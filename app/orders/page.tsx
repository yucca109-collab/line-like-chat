"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function OrdersPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const load = async () => {
	setErr("");
	setLoading(true);

	// ログイン確認
	const { data: userData, error: userErr } = await supabase.auth.getUser();
	if (userErr || !userData.user) {
	  router.push("/login");
	  return;
	}
	setUserEmail(userData.user.email ?? "");

	// 案件一覧取得
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

	const { error } = await supabase.from("orders").insert({
	  title,
	  status: "new",
	});

	if (error) setErr(error.message);
	else load(); // 再読込
  };

  useEffect(() => {
	load();
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
	<div style={{ padding: 40 }}>
	  <h1>案件一覧</h1>
	  <p>ログイン中: {userEmail}</p>

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