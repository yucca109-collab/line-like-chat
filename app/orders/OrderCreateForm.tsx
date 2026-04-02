"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  onCreated?: () => void;
};

export default function OrderCreateForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [store, setStore] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("案件名いれて！");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .maybeSingle();

    const { error } = await supabase.from("orders").insert({
      title,
      store_name: store,
      contact_name: contact,
      created_by: user?.id ?? null,
      created_by_name: profile?.display_name ?? null,
    });

    setLoading(false);

    if (error) {
      alert("エラー: " + error.message);
      return;
    }

    setTitle("");
    setStore("");
    setContact("");
    onCreated?.();
  };

  return (
    <div style={{ marginTop: 20, marginBottom: 24 }}>
      <h2>案件作成</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="案件名"
        />
        <input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="店舗名"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="担当者"
        />

        <button onClick={handleCreate} disabled={loading}>
          {loading ? "作成中..." : "案件作成"}
        </button>
      </div>
    </div>
  );
}
