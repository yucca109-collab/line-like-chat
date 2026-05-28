"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

export default function OrderDetailPage() {

  // ↑ 既存そのまま


  return (
    <div className="page">
      <div className="shell">

        <div className="topBar">
          <button
            type="button"
            onClick={() => router.push("/orders")}
            className="backBtn"
          >
            ← 一覧へ
          </button>
        </div>

        {order && (
          <>
            <section className="chatCard">

              {/* =========================
                  HEADER
              ========================= */}
              <div className="chatHeader">

                <div className="titleBlock">
                  <span className="titleLabel">案件名</span>
                  <h1>{order.title}</h1>
                </div>

                {/* SP ONLY */}
                <div className="spLoginName">
                  {userName}
                </div>

              </div>

              {/* =========================
                  CHAT
              ========================= */}
              <div ref={messagesBoxRef} className="messagesBox">

                {messages.length === 0 ? (
                  <div className="emptyMessage">
                    制作内容・希望サイズ・参考イメージを
                    <br />
                    こちらのチャットへご入力ください
                  </div>
                ) : (
                  <div className="messageList">
                    {/* 既存message mapそのまま */}
                  </div>
                )}

              </div>

              <div className="typingArea">
                {otherTyping ? "入力中..." : ""}
              </div>

              {previewUrls.length > 0 && (
                <div className="previewDock">
                  {/* 既存previewそのまま */}
                </div>
              )}

              <div className="inputBar">

                <label htmlFor="image-upload" className="imageAddBtn">
                  画像を追加
                </label>

                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);

                    if (selected.length === 0) return;

                    setFiles((prev) => [...prev, ...selected]);

                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="メッセージを入力..."
                  rows={1}
                  className="messageInput"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending}
                  className="sendBtn"
                >
                  →
                </button>

              </div>

            </section>

            {/* =========================
                PC ONLY META PANEL
            ========================= */}
            <section className="metaPanel">
              {/* 下全部既存そのまま */}
            </section>

          </>
        )}

      </div>

      <style jsx>{`

        .page {
          min-height: 100vh;
          background: #f3f6fa;
          padding: 46px 20px 60px;
        }

        .shell {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .topBar {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 10px;
        }

        .backBtn {
          background: #ffffff;
          border: 1px solid rgba(17, 24, 39, 0.35);
          border-radius: 999px;
          padding: 10px 20px;
          font-weight: 900;
          cursor: pointer;
        }

        .chatCard {
          background: #465361;
          border-radius: 24px;
          overflow: hidden;
          height: 800px;
          display: flex;
          flex-direction: column;
        }

        .chatHeader {
          height: 72px;
          background: #1e2c3d;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 34px;
        }

        .titleBlock {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 22px;
        }

        .titleLabel {
          font-size: 13px;
          font-weight: 900;
        }

        .titleBlock h1 {
          margin: 0;
          font-size: 36px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spLoginName {
          display: none;
        }

        .messagesBox {
          flex: 1;
          overflow-y: auto;
          padding: 26px 28px;
        }

        .emptyMessage {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: rgba(255,255,255,0.5);
          font-size: 22px;
          font-weight: 900;
          line-height: 1.75;
        }

        .typingArea {
          min-height: 20px;
          padding: 0 32px;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          font-weight: 800;
        }

        .inputBar {
          margin: 14px 30px 28px;
          min-height: 66px;
          border-radius: 999px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
        }

        .imageAddBtn {
          height: 44px;
          padding: 0 24px;
          border-radius: 999px;
          background: #858e98;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .messageInput {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
        }

        .sendBtn {
          width: 50px;
          height: 50px;
          border-radius: 999px;
          border: none;
          background: #06c755;
          color: white;
          font-size: 20px;
          font-weight: 900;
        }

        .metaPanel {
          width: 82%;
          margin: 70px auto 0;
        }

        /* =========================
           SP ONLY
        ========================= */

        @media (max-width: 768px) {

          .page {
            padding: 0;
            background: #f3f6fa;
            min-height: 100dvh;
          }

          .shell {
            width: 100%;
            max-width: none;
          }

          .topBar {
            padding: 10px 12px 0;
            margin: 0;
          }

          .chatCard {
            height: 100dvh;
            min-height: 100dvh;
            border-radius: 0;
          }

          .chatHeader {
            height: 64px;
            padding: 0 16px;
          }

          .titleBlock {
            gap: 10px;
            flex: 1;
            min-width: 0;
          }

          .titleLabel {
            font-size: 11px;
          }

          .titleBlock h1 {
            font-size: 20px;
          }

          .spLoginName {
            display: block;
            flex-shrink: 0;
            color: rgba(255,255,255,0.8);
            font-size: 11px;
            font-weight: 900;
          }

          .messagesBox {
            padding: 18px 14px;
          }

          .emptyMessage {
            font-size: 17px;
          }

          .inputBar {
            margin: 10px 12px 16px;
            min-height: 62px;
            padding: 8px;
          }

          .imageAddBtn {
            height: 40px;
            padding: 0 14px;
            font-size: 10px;
          }

          .messageInput {
            font-size: 13px;
          }

          .sendBtn {
            width: 48px;
            height: 48px;
          }

          /* ↓↓↓ SPでは下全部消す ↓↓↓ */
          .metaPanel {
            display: none;
          }

        }

      `}</style>
    </div>
  );
}
