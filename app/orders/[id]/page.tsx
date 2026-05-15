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
};

type Message = {
  id: string;
  order_id: string;
  content: string | null;
  image_url?: string | null;
  sender_name: string;
  created_at: string;
};

type TypingRow = {
  user_name: string;
  is_typing: boolean;
  updated_at?: string | null;
};

type MessageGroup =
  | {
      type: "single";
      message: Message;
    }
  | {
      type: "image-group";
      sender_name: string;
      created_at: string;
      isMe: boolean;
      images: Message[];
    };

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";

const getDisplayStatus = (status: string): DisplayStatus => {
  if (
    status === "新規" ||
    status === "進行中" ||
    status === "納品済み" ||
    status === "アーカイブ"
  ) {
    return status;
  }
  return "進行中";
};

const getStatusColor = (displayStatus: DisplayStatus) => {
  if (displayStatus === "新規") {
    return {
      bg: "#f59e0b",
      text: "#ffffff",
      shadow: "0 6px 16px rgba(245,158,11,0.18)",
    };
  }

  if (displayStatus === "納品済み") {
    return {
      bg: "#22c55e",
      text: "#ffffff",
      shadow: "0 6px 16px rgba(34,197,94,0.16)",
    };
  }

  if (displayStatus === "アーカイブ") {
    return {
      bg: "#6b7280",
      text: "#ffffff",
      shadow: "0 6px 16px rgba(107,114,128,0.16)",
    };
  }

  return {
    bg: "#3b82f6",
    text: "#ffffff",
    shadow: "0 6px 16px rgba(59,130,246,0.16)",
  };
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const messagesBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [err, setErr] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);

  const [lastSentIds, setLastSentIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

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
    setErr("");
    setLoading(true);

    const name = localStorage.getItem("user_name");
    if (!name) {
      router.push("/login");
      return;
    }

    setUserName(name);

    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id,title,status,store_name,contact_name,created_by_name,created_at,display_id"
      )
      .eq("id", orderId)
      .single();

    if (orderErr) {
      setErr("案件情報の読み込みに失敗しました");
      setLoading(false);
      return;
    }

    setOrder(orderData as Order);

    const { data: msgData, error: msgErr } = await supabase
      .from("messages")
      .select("id,order_id,content,image_url,sender_name,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      setErr("メッセージの読み込みに失敗しました");
    } else {
      setMessages((msgData ?? []) as Message[]);
    }

    setLoading(false);
    await markAsRead();
  };

  const syncTypingState = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const { data, error } = await supabase
      .from("typing_status")
      .select("user_name,is_typing,updated_at")
      .eq("order_id", orderId);

    if (error) return;

    const now = Date.now();

    const someoneTyping = ((data as TypingRow[] | null) ?? []).some((row) => {
      if (row.user_name === name) return false;
      if (!row.is_typing) return false;
      if (!row.updated_at) return true;

      const diff = now - new Date(row.updated_at).getTime();
      return diff < 3000;
    });

    setOtherTyping(someoneTyping);
  };

  const updateTyping = async (isTyping: boolean) => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const { data: existing } = await supabase
      .from("typing_status")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_name", name)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("typing_status")
        .update({
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("typing_status").insert({
        order_id: orderId,
        user_name: name,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const markAsRead = async () => {
    const name = localStorage.getItem("user_name");
    if (!name) return;

    const now = new Date().toISOString();

    const { data: existing, error: selectError } = await supabase
      .from("order_reads")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_name", name)
      .maybeSingle();

    if (selectError) return;

    if (existing?.id) {
      await supabase
        .from("order_reads")
        .update({
          last_read_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("order_reads").insert({
        order_id: orderId,
        user_name: name,
        last_read_at: now,
        updated_at: now,
      });
    }
  };

  const clearTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const removeSelectedFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    setErr("");

    const content = input.trim();
    const name = localStorage.getItem("user_name");

    if (!name) {
      router.push("/login");
      return;
    }

    if (!content && files.length === 0) return;

    setSending(true);

    try {
      const uploadedImageUrls: string[] = [];

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(
            `「${file.name}」のサイズが大きすぎます。5MB以下の画像にしてください。`
          );
        }

        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(
            "画像のアップロードに失敗しました。画像サイズを小さくして再度お試しください。"
          );
        }

        const { data } = supabase.storage
          .from("chat-images")
          .getPublicUrl(filePath);

        uploadedImageUrls.push(data.publicUrl);
      }

      const rowsToInsert: {
        order_id: string;
        content: string | null;
        image_url: string | null;
        sender_name: string;
      }[] = [];

      if (content || uploadedImageUrls.length === 0) {
        rowsToInsert.push({
          order_id: orderId,
          content: content || null,
          image_url: null,
          sender_name: name,
        });
      }

      for (const imageUrl of uploadedImageUrls) {
        rowsToInsert.push({
          order_id: orderId,
          content: null,
          image_url: imageUrl,
          sender_name: name,
        });
      }

      const { data: insertedRows, error } = await supabase
        .from("messages")
        .insert(rowsToInsert)
        .select("id,order_id,content,image_url,sender_name,created_at");

      if (error) {
        throw new Error("メッセージの送信に失敗しました");
      }

      if (insertedRows) {
        const rows = insertedRows as Message[];

        setMessages((prev) => {
          const next = [...prev];
          for (const row of rows) {
            if (!next.some((m) => m.id === row.id)) {
              next.push(row);
            }
          }
          return next;
        });

        setLastSentIds(rows.map((row) => row.id));
        setCanUndo(true);
        clearUndoTimer();

        undoTimerRef.current = setTimeout(() => {
          setCanUndo(false);
          setLastSentIds([]);
        }, 30000);
      }

      await markAsRead();
      clearTypingTimer();
      setInput("");
      setFiles([]);
      await updateTyping(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const undoLastSend = async () => {
    if (lastSentIds.length === 0) return;

    setUndoing(true);
    setErr("");

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .in("id", lastSentIds);

      if (error) {
        throw new Error("送信取り消しに失敗しました");
      }

      setMessages((prev) => prev.filter((m) => !lastSentIds.includes(m.id)));
      setCanUndo(false);
      setLastSentIds([]);
      clearUndoTimer();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "送信取り消しに失敗しました");
    } finally {
      setUndoing(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!messagesBoxRef.current) return;
    messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!orderId) return;

    const messageChannel = supabase
      .channel(`messages-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Message;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };

          if (!oldRow.id) return;

          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        }
      )
      .subscribe();

    const orderChannel = supabase
      .channel(`order-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Order;
          if (row) setOrder(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    syncTypingState();

    const channel = supabase
      .channel(`typing-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          syncTypingState();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") syncTypingState();
      });

    const interval = setInterval(() => {
      syncTypingState();
    }, 2000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    return () => {
      clearTypingTimer();
      clearUndoTimer();
    };
  }, []);

  const groupedMessages: MessageGroup[] = [];

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const isImageOnly = !current.content && !!current.image_url;

    if (!isImageOnly) {
      groupedMessages.push({ type: "single", message: current });
      continue;
    }

    const group: Message[] = [current];
    let j = i + 1;

    while (j < messages.length) {
      const next = messages[j];
      const nextIsImageOnly = !next.content && !!next.image_url;

      const closeInTime =
        Math.abs(
          new Date(next.created_at).getTime() -
            new Date(current.created_at).getTime()
        ) <
        60 * 1000;

      if (
        nextIsImageOnly &&
        next.sender_name === current.sender_name &&
        closeInTime
      ) {
        group.push(next);
        j++;
      } else {
        break;
      }
    }

    if (group.length === 1) {
      groupedMessages.push({ type: "single", message: current });
    } else {
      groupedMessages.push({
        type: "image-group",
        sender_name: current.sender_name,
        created_at: current.created_at,
        isMe: current.sender_name === userName,
        images: group,
      });
      i = j - 1;
    }
  }

  const currentStatus = getDisplayStatus(order?.status ?? "");
  const statusStyle = getStatusColor(currentStatus);
  const hasSendContent = input.trim().length > 0 || files.length > 0;

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

          <div className="loginName">ログイン中:{userName || "読み込み中"}</div>
        </div>

        {loading && <p className="loadingText">読み込み中...</p>}

        {order && (
          <>
            <section className="chatCard">
              <div className="chatHeader">
                <div className="titleBlock">
                  <span className="titleLabel">案件名</span>
                  <h1>{order.title}</h1>
                </div>

                <div className="creatorName">
                  作成者:{order.created_by_name || "未入力"}
                </div>
              </div>

              <div ref={messagesBoxRef} className="messagesBox">
                {messages.length === 0 ? (
                  <div className="emptyMessage">
                    制作内容・希望サイズ・参考イメージを
                    <br />
                    こちらのチャットへご入力ください
                  </div>
                ) : (
                  <div className="messageList">
                    {groupedMessages.map((group, index) => {
                      if (group.type === "single") {
                        const m = group.message;
                        const isMe = m.sender_name === userName;

                        return (
                          <div
                            key={m.id}
                            className={`messageRow ${isMe ? "me" : "other"}`}
                          >
                            <div className="messageWrap">
                              <div className="messageMeta">
                                {m.sender_name} ・{" "}
                                {new Date(m.created_at).toLocaleString("ja-JP")}
                              </div>

                              <div className={`bubble ${isMe ? "me" : "other"}`}>
                                {m.content && <div>{m.content}</div>}

                                {m.image_url && (
                                  <img
                                    src={m.image_url}
                                    alt="送信画像"
                                    className="sentImage"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${group.sender_name}-${group.created_at}-${index}`}
                          className={`messageRow ${group.isMe ? "me" : "other"}`}
                        >
                          <div className="messageWrap">
                            <div className="messageMeta">
                              {group.sender_name} ・{" "}
                              {new Date(group.created_at).toLocaleString("ja-JP")}
                            </div>

                            <div
                              className={`bubble imageBubble ${
                                group.isMe ? "me" : "other"
                              }`}
                            >
                              <div className="imageGrid">
                                {group.images.map((img) => (
                                  <img
                                    key={img.id}
                                    src={img.image_url || ""}
                                    alt="送信画像"
                                    className="groupImage"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="typingArea">{otherTyping ? "入力中..." : ""}</div>

              {previewUrls.length > 0 && (
                <div className="previewDock">
                  {previewUrls.map((item, index) => (
                    <div className="previewItem" key={`${item.file.name}-${index}`}>
                      <img src={item.url} alt={`プレビュー ${index + 1}`} />
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        className="previewRemove"
                        aria-label="画像を削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setInput(value);

                    if (!value.trim()) {
                      updateTyping(false);
                      clearTypingTimer();
                      return;
                    }

                    updateTyping(true);
                    clearTypingTimer();

                    typingTimeoutRef.current = setTimeout(() => {
                      updateTyping(false);
                      typingTimeoutRef.current = null;
                    }, 1500);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "46px";
                    target.style.height = `${Math.min(
                      target.scrollHeight,
                      120
                    )}px`;
                  }}
                  onBlur={() => {
                    updateTyping(false);
                    clearTypingTimer();
                  }}
                  placeholder={
                    files.length > 0 ? "画像を送信できます" : "メッセージを入力..."
                  }
                  rows={1}
                  className="messageInput"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending || !hasSendContent}
                  className="sendBtn"
                  aria-label="送信"
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 20L21 12L3 4V10L15 12L3 14V20Z"
                      fill="white"
                    />
                  </svg>
                </button>
              </div>

          
            </section>

            <section className="metaPanel">
              <div className="storeLine">
                <span>使用店舗名</span>
                <strong>{order.store_name || "店舗名未入力"}</strong>
              </div>

              <div className="metaControls">
                <div className="metaField designerField">
                  <span>担当デザイナー</span>
                  <select defaultValue="">
                    <option value="">未設定</option>
                    <option value="designer1">デザイナー1</option>
                    <option value="designer2">デザイナー2</option>
                  </select>
                </div>

                <div className="statusPill" style={{ background: statusStyle.bg }}>
                  {currentStatus}
                </div>

                <div className="metaField">
                  <span>最終納品日</span>
                  <input type="date" />
                </div>

                <div className="metaField">
                  <span>納品数</span>
                  <input type="number" min="0" placeholder="0" />
                </div>
              </div>

              <div className="futureGrid">
                <button type="button">画像を追加</button>

                <div className="futureBox largeBox">
                  <span>ポートフォリオ書き出し予定エリア</span>
                </div>

                <div className="futureBox smallBox">
                  <span>納品メモ / 連携ログ予定エリア</span>
                </div>
              </div>

              <div className="orderHint">
                <strong>オーダーID：{order.display_id || "未採番"}</strong>
                <br />
                公式LINEでこの案件を呼び出す場合は、
                #から始まるオーダーIDを入力してください。
              </div>
            </section>

            {err && <div className="errorBox">{err}</div>}
          </>
        )}
      </div>

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

        .loadingText {
          color: #475569;
          font-weight: 700;
        }

        .chatCard {
          background: #465361;
          border-radius: 24px;
          overflow: hidden;
          height: 800px;
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
          position: relative;
        }

        .emptyMessage {
          min-height: 400px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 22px;
          font-weight: 900;
          line-height: 1.75;
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
          object-fit: cover;
          background: #111827;
        }

        .sentImage:first-child {
          margin-top: 0;
        }

        .imageGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .groupImage {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
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
        }

        .previewDock {
          display: flex;
          gap: 10px;
          padding: 8px 30px 0;
          overflow-x: auto;
          box-sizing: border-box;
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
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
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
        
          font-size: 15px; /* 20→15 */
          font-weight: 700; /* 900→700 */
        
          resize: none;
          line-height: 1.5;
          font-family: inherit;
          padding: 8px 8px;
          box-sizing: border-box;
        }
        .messageInput::placeholder {
          color: #7b8088;
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
          box-shadow: 0 10px 24px rgba(6, 199, 85, 0.28);
        }

        .sendBtn:disabled {
          background: #94a3b8;
          cursor: default;
          box-shadow: none;
          opacity: 0.7;
        }

        .undoArea {
          margin: -14px 36px 20px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.84);
          font-size: 13px;
          font-weight: 800;
        }

        .undoArea button {
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
          padding: 7px 12px;
          cursor: pointer;
          font-weight: 900;
        }

        .metaPanel {
          width: 82%;
          margin: 70px auto 0;
        }

        .storeLine {
          display: flex;
          align-items: baseline;
          gap: 18px;
          margin-bottom: 18px;
          color: #111827;
        }

        .storeLine span {
          font-size: 15px;
          font-weight: 900;
        }

        .storeLine strong {
          font-size: 28px;
          line-height: 1.2;
        }

        .metaControls {
          min-height: 46px;
          border-radius: 999px;
          border: 1px solid rgba(17, 24, 39, 0.36);
          display: grid;
          grid-template-columns: 280px 160px 1fr 1fr;
          align-items: center;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.55);
          margin-bottom: 34px;
        }

        .metaField {
          height: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 18px;
          border-left: 1px solid rgba(17, 24, 39, 0.24);
          box-sizing: border-box;
        }

        .designerField {
          border-left: none;
        }

        .metaField span {
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
          color: #374151;
        }

        .metaField select,
        .metaField input {
          min-width: 0;
          width: 100%;
          height: 30px;
          border-radius: 10px;
          border: 1px solid rgba(17, 24, 39, 0.25);
          background: #ffffff;
          padding: 0 10px;
          font-weight: 800;
          color: #374151;
          box-sizing: border-box;
        }

        .statusPill {
          height: 30px;
          border-radius: 999px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 950;
          margin: 0 16px;
          box-shadow: ${statusStyle.shadow};
        }

        .futureGrid {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 26px 24px;
          align-items: start;
        }

        .futureGrid > button {
          height: 40px;
          border: none;
          border-radius: 999px;
          background: #858e98;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .futureBox {
          background: #858e98;
          border-radius: 18px;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 18px;
          box-sizing: border-box;
        }

        .largeBox {
          min-height: 128px;
        }

        .smallBox {
          min-height: 128px;
          grid-column: 2;
          width: 72%;
        }

        .orderHint {
          margin-top: 28px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 14px 16px;
          color: #334155;
          font-size: 13px;
          line-height: 1.7;
        }

        .errorBox {
          margin: 18px auto 0;
          max-width: 900px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.6;
        }

        button:hover,
        .imageAddBtn:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.2s ease;
        }

        @media (max-width: 768px) {
          .page {
            padding: 14px;
            background: #f3f6fa;
            height: 100dvh;
            overflow: hidden;
          }

          .shell {
            height: 100%;
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
            background: #ffffff;
          }

          .loginName {
            display: none;
          }

          .chatCard {
            flex: 1;
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

          .emptyMessage {
            min-height: 0;
            font-size: 17px;
            line-height: 1.75;
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
          }

          .imageAddBtn {
            width: auto;
            height: 40px;
            padding: 0 14px;
            font-size: 13px;
          }

          .messageInput {
            font-size: 17px;
            min-height: 42px;
            height: 42px;
            padding: 7px 4px;
          }

          .sendBtn {
            width: 48px;
            height: 48px;
          }

          .undoArea {
            margin: -8px 18px 12px;
          }

          .metaPanel {
            display: none;
          }

          .errorBox {
            position: fixed;
            left: 14px;
            right: 14px;
            bottom: 12px;
            z-index: 20;
          }
        }
      `}</style>
    </div>
  );
}
