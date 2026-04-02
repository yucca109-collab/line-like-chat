"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [name, setName] = useState("");
  const router = useRouter();

  const handleLogin = () => {
    if (!name.trim()) {
      alert("名前を入力してください");
      return;
    }

    localStorage.setItem("user_name", name);
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

        <button onClick={handleLogin}>ログイン</button>
      </div>
    </div>
  );
}
