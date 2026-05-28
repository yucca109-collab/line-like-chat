"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

type Order = {
  id: string;
  title: string;
  status: string;
  store_name: string | null;
  contact_name: string | null;
  created_by_name: string | null;
  created_at: string;
  display_id: string | null;
  designer_name: string | null;
  final_delivery_date: string | null;
  delivery_count: number | null;
};

type Message = {
  id: string;
  order_id: string;
  content: string | null;
  image_url?: string | null;
  sender_name: string;
  created_at: string;
};

export default function OrderDetailPage() {

  /* 省略 */

  return (
    <div className="page">

      {/* 省略 */}

      <style jsx>{`

        .page {
          min-height: 100vh;
          background: #f3f6fa;
          color: #111827;
          padding: 46px 20px 60px;
          box-sizing: border-box;
        }

        .shell {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .topBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }

        .backBtn {
          background: #ffffff;
          color: #263241;
          border: 1px solid rgba(17, 24, 39, 0.35);
          border-radius: 999px;
          padding: 10px 20px;
          cursor: pointer;
          font-weight: 900;
          font-size: 15px;
        }

        .loginName {
          font-size: 15px;
          font-weight: 900;
          color: #263241;
        }

        .chatCard {
          background: #465361;
          border-radius: 24px;
          overflow: hidden;
          height: calc(100dvh - 120px);
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
        }

        .chatHeader {
          height: 72px;
          background: #1e2c3d;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 34px;
          box-sizing: border-box;
          gap: 20px;
          flex-shrink: 0;
        }

        .titleBlock {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 22px;
        }

        .titleLabel {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 900;
        }

        .titleBlock h1 {
          margin: 0;
          font-size: clamp(25px, 4vw, 36px);
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .creatorName {
          flex-shrink: 0;
          font-weight: 900;
          font-size: 18px;
        }

        .messagesBox {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 26px 28px;
          box-sizing: border-box;
        }

        .messageList {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .messageRow {
          display: flex;
        }

        .messageRow.me {
          justify-content: flex-end;
        }

        .messageRow.other {
          justify-content: flex-start;
        }

        .messageWrap {
          width: 100%;
          max-width: min(78%, 560px);
        }

        .messageMeta {
          color: rgba(255, 255, 255, 0.76);
          font-size: 11px;
          margin-bottom: 6px;
          font-weight: 700;
          word-break: break-word;
        }

        .messageRow.me .messageMeta {
          text-align: right;
        }

        .bubble {
          padding: 12px 14px;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          color: #ffffff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .bubble.me {
          background: #06c755;
          border-radius: 20px 20px 6px 20px;
        }

        .bubble.other {
          background: #374151;
          border-radius: 20px 20px 20px 6px;
        }

        .sentImage {
          width: 100%;
          max-width: 280px;
          height: auto;
          border-radius: 14px;
          margin-top: 10px;
          display: block;
          object-fit: contain;
          background: #111827;
        }

        .imageGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .groupImage {
          width: 100%;
          height: auto;
          border-radius: 12px;
          display: block;
          background: #111827;
        }

        .typingArea {
          min-height: 20px;
          padding: 0 32px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          font-weight: 800;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .previewDock {
          display: flex;
          gap: 10px;
          padding: 8px 30px 0;
          overflow-x: auto;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .previewItem {
          width: 86px;
          height: 86px;
          flex: 0 0 auto;
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          background: #111827;
          border: 2px solid rgba(255, 255, 255, 0.5);
        }

        .previewItem img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .previewRemove {
          position: absolute;
          right: 6px;
          top: 6px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: none;
          background: rgba(15, 23, 42, 0.82);
          color: #ffffff;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
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
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .imageAddBtn {
          height: 44px;
          padding: 0 24px;
          border-radius: 999px;
          background: #858e98;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .messageInput {
          flex: 1;
          min-width: 0;
          min-height: 46px;
          height: 46px;
          max-height: 120px;
          border: none;
          outline: none;
          background: transparent;
          color: #475569;
          font-size: 16px;
          font-weight: 700;
          resize: none;
          line-height: 1.5;
          font-family: inherit;
          padding: 8px 8px;
          box-sizing: border-box;
        }

        .sendBtn {
          width: 50px;
          height: 50px;
          border-radius: 999px;
          border: none;
          background: #06c755;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .metaPanel,
        .orderHint,
        .errorBox {
          display: none;
        }

        @media (max-width: 768px) {

          .page {
            padding: 14px;
            min-height: 100dvh;
            overflow: hidden;
          }

          .shell {
            height: 100dvh;
            display: flex;
            flex-direction: column;
          }

          .topBar {
            margin-bottom: 8px;
            flex-shrink: 0;
          }

          .backBtn {
            padding: 8px 14px;
            font-size: 14px;
          }

          .loginName {
            display: none;
          }

          .chatCard {
            flex: 1;
            height: auto;
            min-height: 0;
            border-radius: 22px;
          }

          .chatHeader {
            height: 62px;
            padding: 0 18px;
          }

          .titleBlock {
            gap: 12px;
          }

          .titleLabel {
            font-size: 11px;
          }

          .titleBlock h1 {
            font-size: 24px;
          }

          .creatorName {
            display: none;
          }

          .messagesBox {
            padding: 18px 14px;
          }

          .messageWrap {
            max-width: 86%;
          }

          .messageMeta {
            font-size: 10px;
          }

          .bubble {
            font-size: 14px;
          }

          .typingArea {
            padding: 0 16px;
          }

          .previewDock {
            padding: 8px 16px 0;
          }

          .previewItem {
            width: 74px;
            height: 74px;
            border-radius: 16px;
          }

          .inputBar {
            margin: 10px 12px 16px;
            min-height: 62px;
            padding: 8px;
            gap: 8px;
            border-radius: 20px;
          }

          .imageAddBtn {
            width: auto;
            height: 40px;
            padding: 0 14px;
            font-size: 10px;
          }

          .messageInput {
            font-size: 16px !important;
            min-height: 42px;
            height: 42px;
            padding: 7px 4px;
          }

          .sendBtn {
            width: 48px;
            height: 48px;
          }

          input,
          textarea,
          select {
            font-size: 16px !important;
          }

        }

      `}</style>
    </div>
  );
}
