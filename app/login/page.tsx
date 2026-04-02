"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleLogin = async () => {
    if (!name.trim()) {
      alert("名前を入力してください");
      return;
    }

    if (!email.trim()) {
      alert("メールを入力してください");
      return;
    }

    localStorage.setItem("pending_display_name", name);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/orders`,
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("ログインメールを送信しました");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>スタッフログイン</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="スタッフ名"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
        />
        <button onClick={handleLogin}>ログインリンクを送る</button>
      </div>
    </div>
  );
}
