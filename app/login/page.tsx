"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PASSCODE = "123456";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("user_name");
    if (saved) setName(saved);
  }, []);

  const handleLogin = () => {
    if (!name.trim()) {
      alert("名前を入力してください");
      return;
    }

    if (password !== PASSCODE) {
      alert("パスコードが違います");
      return;
    }

    localStorage.setItem("user_name", name.trim());
    router.push("/orders");
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

        {/* 👇ここに書く */}
        <p style={{ fontSize: 12, color: "#666" }}>
          ※毎回同じ名前でログインしてください
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスコード"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />

        <button onClick={handleLogin}>ログイン</button>
      </div>
    </div>
  );
}
