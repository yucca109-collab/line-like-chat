"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PASSCODE = "123456";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
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

  const handleContinue = () => {
    if (!name.trim()) return;

    if (password !== PASSCODE) {
      alert("パスコードを入力してください");
      return;
    }

    localStorage.setItem("user_name", name.trim());
    router.push("/orders");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 50%, #e8edf5 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              fontSize: 13,
              color: "#475569",
              fontWeight: 600,
              marginBottom: 18,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            社内用ページ
          </div>

          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.3,
              margin: 0,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            ご依頼ページへ入る
          </h1>

          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 15,
              lineHeight: 1.8,
              color: "#64748b",
            }}
          >
            担当者名とパスコードを入力して、案件一覧へ進みます。
          </p>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "#334155",
                marginBottom: 8,
              }}
            >
              スタッフ名
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：山田太郎 / 腕部須斗太郎"
              style={{
                width: "100%",
                height: 52,
                borderRadius: 14,
                border: "1px solid #dbe2ea",
                padding: "0 16px",
                fontSize: 15,
                outline: "none",
                background: "#f8fafc",
                boxSizing: "border-box",
                 color: "#64748b",
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: "#64748b",
                margin: "8px 0 0",
                lineHeight: 1.6,
              }}
            >
              ※ 毎回同じ名前でログインしてください
            </p>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "#334155",
                marginBottom: 8,
              }}
            >
              パスコード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスコードを入力"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLogin();
                }
              }}
              style={{
                width: "100%",
                height: 52,
                borderRadius: 14,
                border: "1px solid #dbe2ea",
                padding: "0 16px",
                fontSize: 15,
                outline: "none",
                background: "#f8fafc",
                boxSizing: "border-box",
                 color: "#64748b",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            style={{
              marginTop: 4,
              height: 54,
              border: "none",
              borderRadius: 16,
              background: "#111827",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
            }}
          >
            ログインして案件一覧へ
          </button>

          
        </div>
      </div>

      <style jsx>{`
        input:focus {
          border-color: #94a3b8 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.12);
        }

        button:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.2s ease;
        }
      `}</style>
    </div>
  );
}
