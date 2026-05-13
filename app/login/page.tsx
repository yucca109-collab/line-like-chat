"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";

const PASSCODE = "123456";
const LIFF_ID = "2010073232-54KHqDHX";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initLogin = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login({
            redirectUri: "https://app.1best.info/login",
          });
          return;
        }

        let lineUserId = "";

        try {
          const profile = await liff.getProfile();
          lineUserId = profile.userId;
        } catch {
          const token = liff.getDecodedIDToken();
          lineUserId = token?.sub || "";
        }

        if (lineUserId) {
          localStorage.setItem("line_user_id", lineUserId);
        }

        const savedName = localStorage.getItem("user_name");
        if (savedName) {
          setName(savedName);
        }

        setChecking(false);
      } catch (err) {
        console.error("LIFF ERROR", err);

        const savedName = localStorage.getItem("user_name");
        if (savedName) {
          setName(savedName);
        }

        setChecking(false);
      }
    };

    initLogin();
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

    const lineUserId = localStorage.getItem("line_user_id");

    if (lineUserId) {
      router.push(
        `/orders?line_user_id=${encodeURIComponent(lineUserId)}&line_name=${encodeURIComponent(
          name.trim()
        )}`
      );
      return;
    }

    router.push("/orders");
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          fontWeight: 700,
          color: "#334155",
        }}
      >
        ログイン確認中...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 50%, #e8edf5 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        gap: 16,
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
            LINE認証済み
          </div>

          <p
            style={{
              marginBottom: 0,
              fontSize: 15,
              lineHeight: 1.8,
              color: "#64748b",
            }}
          >
            表示する担当者名とパスコードを入力して、案件一覧へ進みます。
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
              担当者名
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：山田太郎 / 山田 / ワンベストタロウ"
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
              ※ 案件の作成者名として表示されます
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

      <div style={{ width: "100%", maxWidth: 560 }}>
        <button
          type="button"
          onClick={() => {
            window.open("https://1best.info/gen_v1/", "_blank");
          }}
          style={{
            width: "80%",
            height: 64,
            margin: "0 auto",
            display: "block",
            border: "none",
            borderRadius: 999,
            background: "linear-gradient(90deg, #ff007a, #ff4da6)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(255,0,122,0.25)",
            cursor: "pointer",
          }}
        >
          コピペ用ジェネレーターはこちら
        </button>
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
