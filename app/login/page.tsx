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
          maxWidth: 960,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 24,
        }}
      >
        <div
          style={{
            borderRadius: 28,
            padding: 32,
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 520,
          }}
        >
          <div>
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
                marginBottom: 20,
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
                fontSize: 40,
                lineHeight: 1.15,
                margin: 0,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              ご依頼ページへ
              <br />
              スムーズに入れます
            </h1>

            <p
              style={{
                marginTop: 16,
                marginBottom: 0,
                fontSize: 16,
                lineHeight: 1.8,
                color: "#475569",
                maxWidth: 520,
              }}
            >
              担当者名とパスコードを入力すると、
              案件一覧とチャット画面をご利用いただけます。
              前回の名前は自動で保持されます。
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 32,
            }}
          >
            <div
              style={{
                borderRadius: 20,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: 18,
                boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 6,
                }}
              >
                担当者で続ける
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.7,
                }}
              >
                毎回同じ名前で入ると、案件の管理がわかりやすくなります。
              </div>
            </div>

            <div
              style={{
                borderRadius: 20,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: 18,
                boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 6,
                }}
              >
                シンプルなログイン
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.7,
                }}
              >
                入力は最小限。Enterキーでもそのまま入れます。
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 28,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
            padding: 32,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 520,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#64748b",
                marginBottom: 8,
              }}
            >
              ENTRY
            </div>
            <h2
              style={{
                fontSize: 28,
                lineHeight: 1.3,
                margin: 0,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              担当者情報を入力
            </h2>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 14,
                lineHeight: 1.8,
                color: "#64748b",
              }}
            >
              必要な項目だけ入力して、案件一覧へ進みます。
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
                placeholder="例：山田 / 田中 / yucca"
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

            {mounted && name.trim() && (
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #dbe2ea",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                前回の担当者名「{name.trim()}」で続ける
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 860px) {
          div[style*="grid-template-columns: 1.1fr 0.9fr"] {
            grid-template-columns: 1fr !important;
          }
        }

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
