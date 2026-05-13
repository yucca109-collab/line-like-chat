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

    const name = localStorage.getItem("user_name");
    const lineUserId = localStorage.getItem("line_user_id");


    
    if (!name) {
      alert("ログインし直してください");
      return;
    }

    if (!lineUserId) {
      alert("LINEユーザーIDが取得できません");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("orders").insert({
      title,
      store_name: store,
      contact_name: contact,
      created_by_name: name,
      created_by_line_user_id: lineUserId,
      status: "new",
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

        <button type="button" onClick={handleCreate} disabled={loading}>
          {loading ? "作成中..." : "案件作成"}
        </button>
      </div>
    </div>
  );
}
