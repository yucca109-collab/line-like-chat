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
  product_name: string | null;
  invoice_to: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  created_at: string;
};

type OrderItemDraft = {
  localId: string;
  product_name: string;
  quantity: number;
  unit_price: number | null;
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
  | { type: "single"; message: Message }
  | {
      type: "image-group";
      sender_name: string;
      created_at: string;
      isMe: boolean;
      images: Message[];
    };

type DisplayStatus = "新規" | "進行中" | "納品済み" | "アーカイブ";

const DESIGNER_OPTIONS = ["", "吉本", "ハマダユカ"] as const;

const PRODUCT_OPTIONS = [
  "",
  "PCスライド",
  "SPスライド",
  "フリー(PC/SP)",
  "ロゴ(全媒体)",
  "背景(PC/SP)",
  "フリスペ(縦長)",
  "グラビア3種",
  "ヘブン商品系",
  "GHアピール(PC/SP)",
  "GH大画像",
  "GHメイン/サブ",
  "駅ちかメイン(PC/SP)",
  "駅ちかスライダー",
  "その他バナー",
  "レタッチ",
  "印刷物(1面)",
  "動画",
] as const;

const PRODUCT_TAG_OPTIONS = PRODUCT_OPTIONS.filter(Boolean) as string[];

const PRICE_MAP: Record<string, number> = {
  "PCスライド": 5000,
  "SPスライド": 2000,
  "フリー(PC/SP)": 1000,
  "ロゴ(全媒体)": 1000,
  "背景(PC/SP)": 1000,
  "フリスペ(縦長)": 5000,
  "グラビア3種": 1000,
  "ヘブン商品系": 3000,
  "GHアピール(PC/SP)": 3000,
  "GH大画像": 2000,
  "GHメイン/サブ": 1000,
  "駅ちかメイン(PC/SP)": 5000,
  "駅ちかスライダー": 2000,
  "その他バナー": 3000,
  "レタッチ": 1000,
  "印刷物(1面)": 5000,
  "動画": 5000,
};

const INVOICE_TO_OPTIONS = [
  "",
  "1Best株式会社",
  "藤井 啓輔",
  "その他",
] as const;

const createBlankItem = (): OrderItemDraft => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  product_name: "",
  quantity: 1,
  unit_price: null,
});

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

const getNextStatus = (current: DisplayStatus): DisplayStatus => {
  if (current === "新規") return "進行中";
  if (current === "進行中") return "納品済み";
  if (current === "納品済み") return "アーカイブ";
  return "進行中";
};

const getStatusColor = (displayStatus: DisplayStatus) => {
  if (displayStatus === "新規") return { bg: "#f59e0b", text: "#ffffff" };
  if (displayStatus === "納品済み") return { bg: "#0d83ff", text: "#ffffff" };
  if (displayStatus === "アーカイブ") return { bg: "#6b7280", text: "#ffffff" };

  return { bg: "#3b82f6", text: "#ffffff" };
};

const yen = (amount: number) => {
  return amount.toLocaleString("ja-JP");
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
  const [orderItems, setOrderItems] = useState<OrderItemDraft[]>([
    createBlankItem(),
  ]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingDeliverable, setSavingDeliverable] = useState(false);

  const [err, setErr] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);

  const [lastSentIds, setLastSentIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const [draftDeliveryDate, setDraftDeliveryDate] = useState("");
  const [draftInvoiceTo, setDraftInvoiceTo] = useState("");

  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const [deliverableTags, setDeliverableTags] = useState<string[]>([]);
  const [hashTagText, setHashTagText] = useState("");
  const [publicComment, setPublicComment] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const previewUrls = useMemo(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  const deliverablePreviewUrl = useMemo(() => {
    if (!deliverableFile || !deliverableFile.type.startsWith("image/")) {
      return "";
    }

    return URL.createObjectURL(deliverableFile);
  }, [deliverableFile]);

  const totalDeliveryCount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (!item.product_name) return sum;
      return sum + Number(item.quantity || 0);
    }, 0);
  }, [orderItems]);

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (!item.product_name) return sum;

      const price = item.unit_price ?? PRICE_MAP[item.product_name] ?? 0;
      return sum + price * Number(item.quantity || 0);
    }, 0);
  }, [orderItems]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      if (deliverablePreviewUrl) URL.revokeObjectURL(deliverablePreviewUrl);
    };
  }, [deliverablePreviewUrl]);

  const syncDeliveryDraft = (targetOrder: Order) => {
    setDraftDeliveryDate(targetOrder.final_delivery_date || "");
    setDraftInvoiceTo(targetOrder.invoice_to || "");
  };

  const syncProductTagsFromItems = (items: OrderItemDraft[]) => {
    const productTags = items
      .map((item) => item.product_name)
      .filter(Boolean);

    setDeliverableTags((prevTags) => {
      const customTags = prevTags.filter(
        (tag) => !PRODUCT_TAG_OPTIONS.includes(tag)
      );

      return [...new Set([...productTags, ...customTags])];
    });
  };

  const loadOrderItems = async () => {
    const { data, error } = await supabase
      .from("order_items")
      .select("id,order_id,product_name,quantity,unit_price,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr(`納品明細の読み込みに失敗しました: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as OrderItem[];

    if (rows.length === 0) {
      const blank = [createBlankItem()];
      setOrderItems(blank);
      syncProductTagsFromItems(blank);
      return;
    }

    const drafts = rows.map((row) => ({
      localId: row.id,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price: row.unit_price ?? PRICE_MAP[row.product_name] ?? 0,
    }));

    setOrderItems(drafts);
    syncProductTagsFromItems(drafts);
  };

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
        "id,title,status,store_name,contact_name,created_by_name,created_at,display_id,designer_name,final_delivery_date,delivery_count,product_name,invoice_to"
      )
      .eq("id", orderId)
      .single();

    if (orderErr) {
      setErr("案件情報の読み込みに失敗しました");
      setLoading(false);
      return;
    }

    const loadedOrder = orderData as Order;

    setOrder(loadedOrder);
    syncDeliveryDraft(loadedOrder);

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

    await loadOrderItems();

    setLoading(false);
    await markAsRead();
  };

  const updateDesignerName = async (nextDesignerName: string) => {
    if (!order) return;

    setErr("");
    setSaveMessage("");

    const { error } = await supabase
      .from("orders")
      .update({ designer_name: nextDesignerName || null })
      .eq("id", order.id);

    if (error) {
      setErr(`担当デザイナー更新エラー: ${error.message}`);
      return;
    }

    setOrder((prev) =>
      prev ? { ...prev, designer_name: nextDesignerName || null } : prev
    );
  };

  const updateOrderStatus = async () => {
    if (!order) return;

    setErr("");
    setSaveMessage("");

    const currentStatus = getDisplayStatus(order.status);
    const nextStatus = getNextStatus(currentStatus);

    const updatePayload: {
      status: DisplayStatus;
      final_delivery_date?: string;
    } = {
      status: nextStatus,
    };

    if (nextStatus === "納品済み" && !draftDeliveryDate) {
      const today = new Date().toISOString().slice(0, 10);
      updatePayload.final_delivery_date = today;
      setDraftDeliveryDate(today);
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (error) {
      setErr(`ステータス更新エラー: ${error.message}`);
      return;
    }

    setOrder((prev) => (prev ? { ...prev, ...updatePayload } : prev));
  };

  const updateItem = (
    localId: string,
    field: "product_name" | "quantity" | "unit_price",
    value: string | number | null
  ) => {
    setSaveMessage("");

    setOrderItems((prev) => {
      const nextItems = prev.map((item) => {
        if (item.localId !== localId) return item;

        if (field === "quantity") {
          return {
            ...item,
            quantity: Math.max(0, Number(value || 0)),
          };
        }

        if (field === "unit_price") {
          return {
            ...item,
            unit_price: value === "" || value === null ? null : Number(value),
          };
        }

        const nextProductName = String(value || "");
        const nextUnitPrice = PRICE_MAP[nextProductName] ?? 0;

        return {
          ...item,
          product_name: nextProductName,
          unit_price: nextUnitPrice,
        };
      });

      syncProductTagsFromItems(nextItems);
      return nextItems;
    });
  };

  const addOrderItem = () => {
    setOrderItems((prev) => [...prev, createBlankItem()]);
  };

  const removeOrderItem = (localId: string) => {
    setOrderItems((prev) => {
      const nextItems =
        prev.length <= 1 ? [createBlankItem()] : prev.filter((item) => item.localId !== localId);

      syncProductTagsFromItems(nextItems);
      return nextItems;
    });
  };

  const saveDeliveryInfo = async () => {
    if (!order) return;

    setErr("");
    setSaveMessage("");
    setSavingDelivery(true);

    const normalizedItems = orderItems
      .map((item) => ({
        product_name: item.product_name.trim(),
        quantity: Number(item.quantity || 0),
        unit_price: item.unit_price ?? PRICE_MAP[item.product_name] ?? 0,
      }))
      .filter((item) => item.product_name && item.quantity > 0);

    if (normalizedItems.length === 0) {
      setSavingDelivery(false);
      setErr("納品明細を1つ以上入力してください");
      return;
    }

    const totalCount = normalizedItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const firstProductName = normalizedItems[0]?.product_name || null;

    const { data, error } = await supabase
      .from("orders")
      .update({
        final_delivery_date: draftDeliveryDate || null,
        delivery_count: totalCount,
        product_name: firstProductName,
        invoice_to: draftInvoiceTo || null,
      })
      .eq("id", order.id)
      .select(
        "id,title,status,store_name,contact_name,created_by_name,created_at,display_id,designer_name,final_delivery_date,delivery_count,product_name,invoice_to"
      )
      .single();

    if (error) {
      setSavingDelivery(false);
      setErr(`案件メタ情報の保存に失敗しました: ${error.message}`);
      return;
    }

    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", order.id);

    if (deleteError) {
      setSavingDelivery(false);
      setErr(`納品明細の更新に失敗しました: ${deleteError.message}`);
      return;
    }

    const { data: insertedItems, error: insertError } = await supabase
      .from("order_items")
      .insert(
        normalizedItems.map((item) => ({
          order_id: order.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price:
            item.unit_price ??
            PRICE_MAP[item.product_name] ??
            0,
        }))
      )
      .select("id,order_id,product_name,quantity,unit_price,created_at");

    setSavingDelivery(false);

    if (insertError) {
      setErr(`納品明細の保存に失敗しました: ${insertError.message}`);
      return;
    }

    const updatedOrder = data as Order;
    const rows = (insertedItems ?? []) as OrderItem[];

    const nextItems = rows.map((row) => ({
      localId: row.id,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price: row.unit_price ?? PRICE_MAP[row.product_name] ?? 0,
    }));

    setOrder(updatedOrder);
    syncDeliveryDraft(updatedOrder);
    setOrderItems(nextItems);
    syncProductTagsFromItems(nextItems);

    setSaveMessage("案件メタ情報と納品明細を保存しました");
  };

  const toggleDeliverableTag = (tag: string) => {
    setDeliverableTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const getHashTags = () => {
    return hashTagText
      .split(/[\s,、#]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const getAllWorkTags = () => {
    return [...new Set([...deliverableTags, ...getHashTags()])];
  };

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.src = reader.result as string;
      };

      img.onerror = reject;

      img.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / img.width);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            resolve(
              new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                type: "image/webp",
              })
            );
          },
          "image/webp",
          0.82
        );
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };








  
  const saveDeliverable = async () => {
    if (!order) return;

    if (!deliverableFile) {
      setErr("制作事例ファイルを選択してください");
      return;
    }

    setErr("");
    setSaveMessage("");
    setSavingDeliverable(true);

    try {
      const uploadFile = await compressImage(deliverableFile);

      const fileExt = uploadFile.name.split(".").pop() || "file";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`;

      const filePath = `${order.id}/${fileName}`;
      const allTags = getAllWorkTags();
      const titleForSave = order.store_name || order.title || "制作事例";

      const { error: uploadError } = await supabase.storage
        .from("deliverables")
        .upload(filePath, uploadFile);

      if (uploadError) {
        throw new Error(`アップロード失敗: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("deliverables")
        .getPublicUrl(filePath);

      const { error: worksError } = await supabase.from("works").insert({
        source_order_id: order.id,
        file_url: publicUrlData.publicUrl,
        file_name: uploadFile.name,
        file_type: uploadFile.type || null,
        tags: allTags,
        public_title: titleForSave,
        public_comment: publicComment || null,
        store_name: order.store_name || null,
        order_title: order.title || null,

        designer_name: order.designer_name || null,
         created_by_name: order.created_by_name || null,
      });

      if (worksError) {
        throw new Error(`制作事例への保存に失敗しました: ${worksError.message}`);
      }

      setDeliverableFile(null);
      setDeliverableTags([]);
      setHashTagText("");
      setPublicComment("");

      setSaveMessage("制作事例をアップロードしました");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "制作事例の保存に失敗しました");
    } finally {
      setSavingDeliverable(false);
    }
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
  const lineUserId = localStorage.getItem("line_user_id");

  if (!name) {
    router.push("/login");
    return;
  }

  if (!content && files.length === 0) return;

  setSending(true);

  try {
    const uploadedImageUrls: string[] = [];

    for (const originalFile of files) {
      const file = originalFile;

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
      sender_line_user_id: string | null;
    }[] = [];

    if (content || uploadedImageUrls.length === 0) {
      rowsToInsert.push({
        order_id: orderId,
        content: content || null,
        image_url: null,
        sender_name: name,
        sender_line_user_id: lineUserId || null,
      });
    }

    for (const imageUrl of uploadedImageUrls) {
      rowsToInsert.push({
        order_id: orderId,
        content: null,
        image_url: imageUrl,
        sender_name: name,
        sender_line_user_id: lineUserId || null,
      });
    }

    const { data: insertedRows, error } = await supabase
      .from("messages")
      .insert(rowsToInsert)
      .select("id,order_id,content,image_url,sender_name,created_at");

    if (error) {
      throw new Error(`メッセージの送信に失敗しました: ${error.message}`);
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

      const { data: orderInfo, error: orderInfoError } = await supabase
        .from("orders")
        .select(
          "id,created_by_name,created_by_line_user_id,designer_name,display_id,title"
        )
        .eq("id", orderId)
        .single();

      if (orderInfoError) {
        console.error("通知予約用の案件取得エラー", orderInfoError.message);
      }

      if (orderInfo && lineUserId) {
        const recipients: {
          recipient_line_user_id: string;
          recipient_name: string | null;
        }[] = [];

        const isCreatorSender =
          orderInfo.created_by_line_user_id &&
          orderInfo.created_by_line_user_id === lineUserId;

        const isDesignerSender =
          orderInfo.designer_name && orderInfo.designer_name === name;

        if (isCreatorSender) {
          const { data: designerUsers, error: designerUsersError } =
            await supabase
              .from("line_users")
              .select("line_user_id,line_name,role")
              .eq("role", "designer");

          if (designerUsersError) {
            console.error(
              "designer/admin取得エラー",
              designerUsersError.message
            );
          }

          for (const user of designerUsers ?? []) {
            if (
              user.line_user_id &&
              user.line_user_id !== lineUserId &&
              !recipients.some(
                (r) => r.recipient_line_user_id === user.line_user_id
              )
            ) {
              recipients.push({
                recipient_line_user_id: user.line_user_id,
                recipient_name: user.line_name ?? null,
              });
            }
          }
        } else {
          if (
            orderInfo.created_by_line_user_id &&
            orderInfo.created_by_line_user_id !== lineUserId
          ) {
            recipients.push({
              recipient_line_user_id: orderInfo.created_by_line_user_id,
              recipient_name: orderInfo.created_by_name ?? null,
            });
          }
        }

        for (const recipient of recipients) {
          const { error: jobError } = await supabase
            .from("line_notification_jobs")
            .insert({
              order_id: orderId,
              message_id: rows[rows.length - 1].id,
              sender_line_user_id: lineUserId,
              sender_name: name,
              recipient_line_user_id: recipient.recipient_line_user_id,
              recipient_name: recipient.recipient_name,
              notify_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            });

          if (jobError) {
            console.error("通知予約INSERTエラー", jobError.message);
          }
        }
      }
    }

    await markAsRead();
    clearTypingTimer();
    setInput("");
    setFiles([]);
    await updateTyping(false);
  } catch (e) {
    console.error(e);
    setErr(e instanceof Error ? e.message : String(e));
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
          if (!row) return;

          setOrder(row);
          syncDeliveryDraft(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(orderChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                                      onClick={() => setModalImage(m.image_url || null)}
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
                                    onClick={() => setModalImage(img.image_url || null)}
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
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
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

            <section className="workPanel">
              <div className="workTop">
                <div className="storeNameBlock">
                  <span>使用店舗名</span>
                  <strong>{order.store_name || "店舗名未入力"}</strong>
                </div>

                <button
                  type="button"
                  className="largeStatusBtn"
                  style={{
                    background: statusStyle.bg,
                    color: statusStyle.text,
                  }}
                  onClick={updateOrderStatus}
                >
                  {currentStatus}
                </button>
              </div>

              <div className="workCard">
                <div className="metaBox">
                  <div className="metaTopRow">
                    <label className="metaItem">
                      <span>請求先</span>
                      <select
                        value={draftInvoiceTo}
                        onChange={(e) => {
                          setDraftInvoiceTo(e.target.value);
                          setSaveMessage("");
                        }}
                      >
                        {INVOICE_TO_OPTIONS.map((name) => (
                          <option key={name || "empty"} value={name}>
                            {name || "未設定"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="metaItem">
                      <span>最終納品日</span>
                      <input
                        type="date"
                        value={draftDeliveryDate}
                        onChange={(e) => {
                          setDraftDeliveryDate(e.target.value);
                          setSaveMessage("");
                        }}
                      />
                    </label>

                    <label className="metaItem">
                      <span>担当デザイナー</span>
                      <select
                        value={order.designer_name || ""}
                        onChange={(e) => updateDesignerName(e.target.value)}
                      >
                        {DESIGNER_OPTIONS.map((name) => (
                          <option key={name || "empty"} value={name}>
                            {name || "未設定"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="itemBox">
                      <div className="itemBoxHead">
                        <strong>納品明細</strong>
                      
                        <span>
                          合計納品数：{totalDeliveryCount}
                        </span>
                      </div>

                    <div className="itemRows">
                      {orderItems.map((item) => {
                        const unitPrice =
                          item.unit_price ?? PRICE_MAP[item.product_name] ?? 0;
                        const subtotal = unitPrice * Number(item.quantity || 0);

                        return (
                          <div className="itemRow" key={item.localId}>
                            <label>
                              <span>商品名</span>
                              <select
                                value={item.product_name}
                                onChange={(e) =>
                                  updateItem(
                                    item.localId,
                                    "product_name",
                                    e.target.value
                                  )
                                }
                              >
                                {PRODUCT_OPTIONS.map((name) => (
                                  <option key={name || "empty"} value={name}>
                                    {name || "未設定"}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="quantityLabel">
                              <span>数量</span>
                              <input
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    item.localId,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                              />
                            </label>

                        

                            <button
                              type="button"
                              className="removeItemBtn"
                              onClick={() => removeOrderItem(item.localId)}
                            >
                              削除
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button type="button" className="addItemBtn" onClick={addOrderItem}>
                      ＋ 明細を追加
                    </button>
                  </div>

                  <button
                    type="button"
                    className="saveMetaBtn"
                    onClick={saveDeliveryInfo}
                    disabled={savingDelivery}
                  >
                    {savingDelivery ? "保存中" : "保存"}
                  </button>
                </div>

                <div className="divider" />

                {saveMessage && <div className="saveMessage">{saveMessage}</div>}

                <div className="uploadBox">
                  <div
                    className={`dropArea ${isDragOver ? "isDragOver" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) setDeliverableFile(file);
                    }}
                  >
                    <label htmlFor="deliverable-upload" className="dropLabel">
                      <input
                        id="deliverable-upload"
                        type="file"
                        onChange={(e) => {
                          setDeliverableFile(e.target.files?.[0] || null);
                          e.currentTarget.value = "";
                        }}
                      />

                      <div className="dropIcon" aria-hidden="true">
                        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                          <path d="M427.258,244.249c0.204-2.604,0.338-5.228,0.338-7.885c0-55.233-44.775-100.008-100.008-100.008c-17.021,0-33.042,4.264-47.072,11.764c-15.136-42.633-55.81-73.172-103.633-73.172c-60.729,0-109.96,49.231-109.96,109.96c0,11.416,1.741,22.425,4.97,32.778C29.804,234.254,0,275.238,0,323.21c0,62.627,50.769,113.396,113.396,113.396h292.642c3.021,0.284,6.079,0.445,9.175,0.445c53.454,0,96.788-43.333,96.788-96.788C512,290.891,475.024,250.183,427.258,244.249z M311.709,296.227h-20.452c-6.044,0-10.989,4.945-10.989,10.99v58.074c0,6.044-4.946,10.99-10.989,10.99h-26.558c-6.044,0-10.989-4.946-10.989-10.99v-58.074c0-6.044-4.945-10.99-10.989-10.99h-20.452c-6.044,0-8-3.94-4.347-8.755l53.414-70.405c3.652-4.816,9.631-4.816,13.284,0l53.414,70.405C319.709,292.288,317.753,296.227,311.709,296.227z" />
                        </svg>
                      </div>

                      <strong>ドラッグ＆ドロップでアップロード</strong>
                      <span>クリックしてファイル選択もできます</span>
                    </label>

                    {deliverableFile && (
                      <div className="selectedFile">
                        {deliverablePreviewUrl ? (
                          <img src={deliverablePreviewUrl} alt="選択ファイル" />
                        ) : (
                          <div className="fileIcon">FILE</div>
                        )}

                        <div className="selectedFileInfo">
                          <strong>{deliverableFile.name}</strong>
                          <small>{deliverableFile.type || "file"}</small>
                        </div>

                        <button
                          type="button"
                          className="removeFileButton"
                          onClick={() => setDeliverableFile(null)}
                          aria-label="ファイルを外す"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="workForm">
                    <div className="tagList">
                      {PRODUCT_TAG_OPTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={
                            deliverableTags.includes(tag) ? "tag active" : "tag"
                          }
                          onClick={() => toggleDeliverableTag(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="commentInput"
                      value={publicComment}
                      onChange={(e) => setPublicComment(e.target.value)}
                      placeholder="公開コメント"
                    />

                    <input
                      className="hashInput"
                      value={hashTagText}
                      onChange={(e) => setHashTagText(e.target.value)}
                      placeholder="ハッシュタグ 例：金沢 求人 夏 イベント"
                    />

                    <button
                      type="button"
                      className="saveWorkBtn"
                      onClick={saveDeliverable}
                      disabled={savingDeliverable}
                    >
                      {savingDeliverable ? "アップロード中..." : "制作事例をアップロード"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="orderHint">
                <strong>オーダーID：{order.display_id || "未採番"}</strong>
                <br />
                公式LINEでこの案件を呼び出す場合は、#から始まるオーダーIDを入力してください。
              </div>
            </section>

            {err && <div className="errorBox">{err}</div>}
            {modalImage && (
              <div
                className="imageModal"
                onClick={() => setModalImage(null)}
              >
                <img
                  src={modalImage}
                  alt="拡大画像"
                  className="modalImage"
                  onClick={() => setModalImage(null)}
                />
              </div>
            )}
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
          touch-action: manipulation;
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
          font-size: 13px;
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
          margin-bottom: 56px;
        }

        .chatHeader {
          height: 72px;
          background: #1e2c3d;
          color: #ffffff;
          display: flex;
          align-items: center;
          padding: 0 34px;
          box-sizing: border-box;
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

        .messagesBox {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 26px 28px;
          box-sizing: border-box;
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
          max-width: 360px;
          height: auto;
          border-radius: 14px;
          margin-top: 10px;
          display: block;
          object-fit: cover;
          background: #111827;
        }

.imageGrid {
  display: grid;
  grid-template-columns: repeat(2, 120px);
  gap: 6px;
  max-width: 246px;
}

.groupImage {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
  background: #111827;
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

        .sendBtn:disabled {
          background: #94a3b8;
          cursor: default;
          opacity: 0.7;
        }

        .workPanel {
          width: 90%;
          margin: 0 auto;
        }

        .workTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 14px;
        }

        .storeNameBlock {
          display: flex;
          align-items: baseline;
          gap: 16px;
        }

        .storeNameBlock span {
          font-size: 15px;
          font-weight: 950;
        }

        .storeNameBlock strong {
          font-size: 28px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .largeStatusBtn {
          min-width: 180px;
          height: 54px;
          border: none;
          border-radius: 999px;
          font-size: 18px;
          font-weight: 950;
          cursor: pointer;
        }

        .workCard {
          background: #ffffff;
          border: 1.6px solid #777;
          border-radius: 22px;
          padding: 54px 48px 42px;
          margin-bottom: 26px;
        }

        .metaBox {
          display: grid;
          gap: 28px;
        }

        .metaTopRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          align-items: center;
        }

        .metaItem {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .metaItem span,
        .itemRow label span {
          font-weight: 950;
          font-size: 15px;
          white-space: nowrap;
        }

        .metaItem select,
        .metaItem input,
        .itemRow select,
        .itemRow input {
          width: 100%;
          height: 48px;
          border: 1.8px solid #999;
          border-radius: 999px;
          background: #ffffff;
          padding: 0 20px;
          font-size: 16px;
          font-weight: 900;
          color: #111827;
          box-sizing: border-box;
        }

        .itemBox {
          background: #f8fafc;
          border-radius: 18px;
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .itemBoxHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .itemBoxHead strong {
          font-size: 17px;
          font-weight: 950;
        }

        .itemBoxHead span {
          font-size: 13px;
          font-weight: 950;
          color: #475569;
        }

        .itemRows {
          display: grid;
          gap: 10px;
        }

        .itemRow {
          display: grid;
          grid-template-columns: 1fr 140px 90px;
          gap: 10px;
          align-items: end;
        }

        .itemRow label {
          display: grid;
          gap: 6px;
        }

        .priceDisplay {
          height: 48px;
          border-radius: 999px;
          background: #ffffff;
          border: 1.8px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 0 14px;
          box-sizing: border-box;
        }

        .priceDisplay span {
          font-size: 11px;
          font-weight: 950;
          color: #64748b;
        }

        .priceDisplay strong {
          font-size: 13px;
          font-weight: 950;
          color: #111827;
        }

        .removeItemBtn {
          height: 48px;
          border: none;
          border-radius: 999px;
          background: #ef4444;
          color: #ffffff;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        .addItemBtn {
          width: 160px;
          height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #ffffff;
          color: #111827;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
        }

        .saveMetaBtn {
          justify-self: end;
          width: 130px;
          height: 42px;
          border: none;
          border-radius: 999px;
          background: #111827;
          color: #ffffff;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
        }

        .divider {
          height: 1.5px;
          background: #9ca3af;
          margin: 34px 0 32px;
        }

        .saveMessage {
          color: #16a34a;
          font-size: 13px;
          font-weight: 950;
          margin: 0 0 20px;
        }

        .uploadBox {
          background: #ffffff;
        }

        .dropArea {
          width: 100%;
          margin: 0 auto 28px;
          border: 2px dashed #d8d0ff;
          border-radius: 24px;
          background: #fbfaff;
          padding: 48px 34px 30px;
          box-sizing: border-box;
          text-align: center;
        }

        .dropArea.isDragOver {
          background: #f1efff;
          border-color: #7c6bff;
        }

        .dropLabel {
          cursor: pointer;
          display: grid;
          gap: 8px;
          justify-items: center;
        }

        .dropLabel input {
          display: none;
        }

        .dropIcon {
          width: 72px;
          height: 72px;
          color: #7c6bff;
          margin-bottom: 16px;
        }

        .dropIcon svg {
          width: 100%;
          height: 100%;
          display: block;
          fill: currentColor;
        }

        .dropLabel strong {
          font-size: 22px;
          line-height: 1.25;
          font-weight: 950;
          color: #2f2f44;
        }

        .dropLabel span {
          font-size: 13px;
          color: #6b7280;
          font-weight: 800;
        }

        .selectedFile {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 70px 1fr 40px;
          align-items: center;
          gap: 14px;
          text-align: left;
          background: #ffffff;
          border-radius: 16px;
          padding: 10px 12px;
        }

        .selectedFile img,
        .fileIcon {
          width: 70px;
          height: 48px;
          object-fit: cover;
          border-radius: 10px;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 950;
        }

        .selectedFileInfo {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selectedFile strong {
          display: block;
          font-size: 14px;
          color: #374151;
          word-break: break-all;
        }

        .selectedFile small {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 800;
        }

        .removeFileButton {
          border: none;
          background: transparent;
          color: #ff5f5f;
          font-size: 28px;
          cursor: pointer;
        }

        .workForm {
          display: grid;
          gap: 14px;
        }

        .tagList {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          min-width: 86px;
          min-height: 30px;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #ffffff;
          color: #334155;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
        }

        .tag.active {
          background: #111827;
          border-color: #111827;
          color: #ffffff;
        }

        .hashInput,
        .commentInput {
          width: 100%;
          border-radius: 14px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          padding: 12px 14px;
          font-size: 16px;
          font-weight: 800;
          color: #374151;
          box-sizing: border-box;
          font-family: inherit;
        }

        .commentInput {
          min-height: 82px;
          resize: vertical;
          line-height: 1.6;
        }

        .saveWorkBtn {
          width: min(760px, 100%);
          justify-self: center;
          height: 56px;
          border: none;
          border-radius: 999px;
          background: #1847ff;
          color: #ffffff;
          font-size: 18px;
          font-weight: 950;
          cursor: pointer;
          margin-top: 8px;
        }

        .saveWorkBtn:disabled {
          background: #94a3b8;
          cursor: default;
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


        .imageModal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        }
        
        .modalImage {
          max-width: 95vw;
          max-height: 95vh;
          object-fit: contain;
          border-radius: 12px;
        }
        
        .sentImage,
        .groupImage {
          cursor: zoom-in;
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
        .imageAddBtn:hover,
        .dropLabel:hover {
          opacity: 0.96;
          transform: translateY(-1px);
          transition: 0.2s ease;
        }

        @media (max-width: 768px) {
          .page {
            padding: 10px;
            background: #465361;
            min-height: 100dvh;
            overflow-x: hidden;
          }

          .shell {
            width: 100%;
            max-width: none;
          }

          .topBar {
            margin-bottom: 8px;
          }

          .backBtn {
            padding: 8px 14px;
            font-size: 13px;
          }

          .loginName {
            font-size: 12px;
            color: #ffffff;
          }

          .chatCard {
            width: 100%;
            height: calc(100dvh - 72px);
            min-height: 0;
            border-radius: 18px;
            margin-bottom: 0;
            box-shadow: none;
          }

          .chatHeader {
            height: 58px;
            padding: 0 16px;
          }

          .titleBlock {
            gap: 10px;
          }

          .titleLabel {
            font-size: 11px;
          }

          .titleBlock h1 {
            font-size: 16px;
          }

          .messagesBox {
            padding: 16px 10px;
          }

          .emptyMessage {
            min-height: 0;
            font-size: 16px;
            line-height: 1.7;
          }

          .messageWrap {
            max-width: 94%;
          }

          .messageMeta {
            font-size: 10px;
          }

          .bubble {
            font-size: 14px;
          }

          .sentImage {
            max-width: 100%;
            width: 100%;
            border-radius: 14px;
          }

.imageGrid {
  grid-template-columns: repeat(2, 1fr);
  max-width: 100%;
}

.groupImage {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
}
          .typingArea {
            padding: 0 16px;
          }

          .previewDock {
            padding: 8px 12px 0;
          }

          .inputBar {
            margin: 10px 10px 14px;
            min-height: 62px;
            padding: 8px;
            gap: 8px;
          }

          .imageAddBtn {
            height: 40px;
            padding: 0 12px;
            font-size: 11px;
          }

          .messageInput {
            font-size: 16px;
            min-height: 42px;
            height: 42px;
            padding: 7px 4px;
          }

          .sendBtn {
            width: 46px;
            height: 46px;
          }

          .workPanel,
          .orderHint,
          .errorBox {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
