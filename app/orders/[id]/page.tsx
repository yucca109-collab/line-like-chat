"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  type: string;
  created_at: string;
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [myUserId, setMyUserId] = useState<string>("");
  const [input, setInput] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  const scrollToBottom = (smooth = true) => {
	const el = bottomRef.current;
	if (!el) return;
	el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const loadAll = async () => {
	setErr("");
	setLoading(true);

	const { data: userData, error: userErr } = await supabase.auth.getUser();
	if (userErr || !userData.user) {
	  router.push("/login");
	  return;
	}
	setMyUserId(userData.user.id);

	const { data: orderData, error: orderErr } = await supabase
	  .from("orders")
	  .select("id,title,status,created_at")
	  .eq("id", orderId)
	  .single();

	if (orderErr) {
	  setErr(orderErr.message);
	  setLoading(false);
	  return;
	}
	setOrder(orderData as OrderRow);

	const { data: msgData, error: msgErr } = await supabase
	  .from("messages")
	  .select("id,order_id,sender_id,body,type,created_at")
	  .eq("order_id", orderId)
	  .order("created_at", { ascending: true });

	if (msgErr) setErr(msgErr.message);
	else setMessages((msgData ?? []) as MessageRow[]);

	setLoading(false);

	setTimeout(() => scrollToBottom(false), 0);
  };

  const sendTyping = async (isTyping: boolean) => {
	if (!channelRef.current || !myUserId) return;

	await channelRef.current.send({
	  type: "broadcast",
	  event: "typing",
	  payload: {
		orderId,
		userId: myUserId,
		isTyping,
	  },
	});
  };

  const handleInputChange = async (value: string) => {
	setInput(value);

	if (!myUserId) return;

	// 入力がある間は typing=true
	if (value.trim().length > 0) {
	  await sendTyping(true);

	  if (typingTimeoutRef.current) {
		clearTimeout(typingTimeoutRef.current);
	  }

	  typingTimeoutRef.current = setTimeout(() => {
		sendTyping(false);
	  }, 1200);
	} else {
	  if (typingTimeoutRef.current) {
		clearTimeout(typingTimeoutRef.current);
	  }
	  await sendTyping(false);
	}
  };

  const sendMessage = async () => {
	const body = input.trim();
	if (!body) return;

	setErr("");

	const { data, error } = await supabase
	  .from("messages")
	  .insert({
		order_id: orderId,
		sender_id: myUserId,
		body,
		type: "text",
	  })
	  .select("id,order_id,sender_id,body,type,created_at")
	  .single();

	if (error) {
	  setErr(error.message);
	  return;
	}

	if (data) {
	  const newMsg = data as MessageRow;
	  setMessages((prev) => {
		if (prev.some((m) => m.id === newMsg.id)) return prev;
		return [...prev, newMsg];
	  });
	}

	setInput("");
	setOtherTyping(false);
	await sendTyping(false);
  };

  useEffect(() => {
	if (!orderId) return;
	loadAll();
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
	if (!orderId || !myUserId) return;

	const channel = supabase
	  .channel(`messages:${orderId}`, {
		config: {
		  broadcast: { self: false },
		},
	  })
	  .on(
		"postgres_changes",
		{
		  event: "INSERT",
		  schema: "public",
		  table: "messages",
		  filter: `order_id=eq.${orderId}`,
		},
		(payload) => {
		  const newMsg = payload.new as MessageRow;
		  setMessages((prev) => {
			if (prev.some((m) => m.id === newMsg.id)) return prev;
			return [...prev, newMsg];
		  });
		}
	  )
	  .on("broadcast", { event: "typing" }, ({ payload }) => {
		if (!payload) return;
		if (payload.orderId !== orderId) return;
		if (payload.userId === myUserId) return;

		setOtherTyping(Boolean(payload.isTyping));
	  })
	  .subscribe((status) => {
		console.log("realtime status:", status);
	  });

	channelRef.current = channel;

	return () => {
	  if (typingTimeoutRef.current) {
		clearTimeout(typingTimeoutRef.current);
	  }
	  channelRef.current = null;
	  supabase.removeChannel(channel);
	};
  }, [orderId, myUserId]);

  useEffect(() => {
	scrollToBottom(true);
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, otherTyping]);

  return (
	<div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
	  <div style={{ width: "100%", maxWidth: 720 }}>
		<button onClick={() => router.push("/orders")}>← 一覧へ</button>

		{loading && <p style={{ marginTop: 16 }}>読み込み中...</p>}
		{err && <p style={{ marginTop: 16, color: "tomato" }}>エラー: {err}</p>}

		{order && (
		  <div style={{ marginTop: 16 }}>
			<h1>{order.title}</h1>
			<p>status: {order.status}</p>
			<p>created: {new Date(order.created_at).toLocaleString()}</p>

			<hr style={{ margin: "24px 0" }} />

			<h2>チャット</h2>

			<div
			  style={{
				marginTop: 12,
				border: "1px solid rgba(255,255,255,0.15)",
				borderRadius: 16,
				padding: 16,
				height: 420,
				overflowY: "auto",
				background: "rgba(255,255,255,0.03)",
			  }}
			>
			  {messages.length === 0 ? (
				<p style={{ opacity: 0.7 }}>まだメッセージがありません</p>
			  ) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
				  {messages.map((m) => {
					const isMe = m.sender_id === myUserId;

					return (
					  <div
						key={m.id}
						style={{
						  display: "flex",
						  justifyContent: isMe ? "flex-end" : "flex-start",
						}}
					  >
						<div style={{ maxWidth: "70%" }}>
						  <div
							style={{
							  fontSize: 12,
							  opacity: 0.6,
							  marginBottom: 4,
							  textAlign: isMe ? "right" : "left",
							}}
						  >
							{new Date(m.created_at).toLocaleString()}
						  </div>

						  <div
							style={{
							  padding: "10px 12px",
							  borderRadius: 16,
							  lineHeight: 1.5,
							  whiteSpace: "pre-wrap",
							  wordBreak: "break-word",
							  background: isMe
								? "rgba(34,197,94,0.25)"
								: "rgba(255,255,255,0.10)",
							  border: "1px solid rgba(255,255,255,0.12)",
							}}
						  >
							{m.body}
						  </div>
						</div>
					  </div>
					);
				  })}

				  {otherTyping && (
					<div
					  style={{
						display: "flex",
						justifyContent: "flex-start",
					  }}
					>
					  <div
						style={{
						  maxWidth: "70%",
						  padding: "10px 12px",
						  borderRadius: 16,
						  lineHeight: 1.5,
						  background: "rgba(255,255,255,0.08)",
						  border: "1px solid rgba(255,255,255,0.12)",
						  fontSize: 14,
						  opacity: 0.8,
						}}
					  >
						入力中...
					  </div>
					</div>
				  )}

				  <div ref={bottomRef} />
				</div>
			  )}
			</div>

			<form
			  onSubmit={(e) => {
				e.preventDefault();
				sendMessage();
			  }}
			  style={{
				marginTop: 12,
				display: "flex",
				gap: 8,
				alignItems: "center",
			  }}
			>
			  <input
				id="chat-input"
				name="chat-input"
				value={input}
				onChange={(e) => handleInputChange(e.target.value)}
				placeholder="メッセージを入力"
				style={{
				  flex: 1,
				  minWidth: 240,
				  padding: "12px 14px",
				  borderRadius: 14,
				  border: "1px solid rgba(255,255,255,0.18)",
				  background: "rgba(0,0,0,0.2)",
				  color: "white",
				  outline: "none",
				}}
			  />

			  <button type="submit" disabled={!canSend}>
				送信
			  </button>

			  <button type="button" onClick={loadAll}>
				再読み込み
			  </button>
			</form>
		  </div>
		)}
	  </div>
	</div>
  );
}