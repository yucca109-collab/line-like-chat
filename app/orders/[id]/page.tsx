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
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const messagesBoxRef = useRef<HTMLDivElement | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [userName, setUserName] = useState("");

  const previewUrls = useMemo(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewUrls]);

  const loadAll = async () => {
    const name = localStorage.getItem("user_name");

    if (!name) {
      router.push("/login");
      return;
    }

    setUserName(name);

    const { data: orderData } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    setOrder(orderData);

    const { data: msgData } = await supabase
      .from("messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    setMessages(msgData || []);
  };

  useEffect(() => {
    if (!orderId) return;
    loadAll();
  }, [orderId]);

  useEffect(() => {
    if (!messagesBoxRef.current) return;
    messagesBoxRef.current.scrollTop =
      messagesBoxRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="page">
      <div className="shell">

        <section className="chatCard">

          <div ref={messagesBoxRef} className="messagesBox">
            {messages.length === 0 ? (
              <div className="emptyMessage">
                制作内容・希望サイズ・参考イメージを
                <br />
                こちらのチャットへご入力ください
              </div>
            ) : (
              <div className="messageList">
                {messages.map((m) => {
                  const isMe = m.sender_name === userName;

                  return (
                    <div
                      key={m.id}
                      className={`messageRow ${
                        isMe ? "me" : "other"
                      }`}
                    >
                      <div className="messageWrap">

                        <div className="messageMeta">
                          {m.sender_name}
                        </div>

                        <div
                          className={`bubble ${
                            isMe ? "me" : "other"
                          }`}
                        >
                          {m.content && <div>{m.content}</div>}

                          {m.image_url && (
                            <img
                              src={m.image_url}
                              alt=""
                              className="sentImage"
                            />
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {previewUrls.length > 0 && (
            <div className="previewDock">
              {previewUrls.map((item, index) => (
                <div
                  className="previewItem"
                  key={index}
                >
                  <img src={item.url} alt="" />
                </div>
              ))}
            </div>
          )}

          <div className="inputBar">

            <label
              htmlFor="image-upload"
              className="imageAddBtn"
            >
              画像を追加
            </label>

            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.files ?? []
                );

                setFiles((prev) => [
                  ...prev,
                  ...selected,
                ]);
              }}
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
              className="sendBtn"
            >
              →
            </button>

          </div>

        </section>

      </div>

      <style jsx>{`
        .page {
          background: #f3f6fa;
          min-height: 100dvh;
          overflow: hidden;
          padding: 14px;
          box-sizing: border-box;
        }

        .shell {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
        }

        .chatCard {
          background: #465361;
          border-radius: 24px;
          overflow: hidden;
          height: calc(100dvh - 28px);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .messagesBox {
          flex: 1;
          overflow-y: auto;
          padding: 24px 14px 120px;
          box-sizing: border-box;
        }

        .emptyMessage {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: rgba(255,255,255,0.55);
          font-size: 18px;
          font-weight: 900;
          line-height: 1.8;
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
          max-width: 84%;
        }

        .messageMeta {
          color: rgba(255,255,255,0.7);
          font-size: 11px;
          margin-bottom: 4px;
        }

        .bubble {
          padding: 12px 14px;
          border-radius: 18px;
          color: white;
          line-height: 1.6;
          word-break: break-word;
        }

        .bubble.me {
          background: #06c755;
        }

        .bubble.other {
          background: #374151;
        }

        .sentImage {
          width: 100%;
          border-radius: 14px;
          margin-top: 8px;
        }

        .previewDock {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 10px 14px 0;
          background: #465361;
        }

        .previewItem {
          width: 70px;
          height: 70px;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .previewItem img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .inputBar {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 12px;

          min-height: 64px;

          border-radius: 999px;
          background: #f8fafc;

          display: flex;
          align-items: center;
          gap: 8px;

          padding: 8px;
          box-sizing: border-box;
        }

        .imageAddBtn {
          height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          background: #858e98;
          color: #fff;

          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .messageInput {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;

          resize: none;

          font-size: 14px;
          font-weight: 700;
          color: #374151;

          min-height: 42px;
          max-height: 120px;

          padding: 8px 4px;
          box-sizing: border-box;
        }

        .sendBtn {
          width: 46px;
          height: 46px;

          border-radius: 999px;
          border: none;

          background: #06c755;
          color: white;

          font-size: 22px;
          font-weight: 900;

          flex-shrink: 0;
        }

        @media (min-width: 769px) {
          .shell {
            max-width: 680px;
          }

          .chatCard {
            height: calc(100vh - 40px);
          }
        }
      `}</style>
    </div>
  );
}
