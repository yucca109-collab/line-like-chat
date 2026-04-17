"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PASSCODE = "123456";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const savedName = localStorage.getItem("user_name");
    if (savedName) {
      setName(savedName);
    }
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
      <h1>ログイン</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="スタッフ名"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスコード"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleLogin();
            }
          }}
        />

        <button type="button" onClick={handleLogin}>
          ログイン
        </button>
      </div>
    </div>
  );
}
