import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminChat() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: convs = [] } = useQuery({
    queryKey: ["admin-chat-convs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("id, user_id, last_message_at, last_message_preview, unread_admin")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const ids = Array.from(new Set((data || []).map((c: any) => c.user_id)));
      let map: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        map = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return (data || []).map((c: any) => ({ ...c, name: map[c.user_id] || "User" }));
    },
    refetchInterval: 10000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-chat-msgs", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_role, content, created_at")
        .eq("conversation_id", selected!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Realtime new messages
  useEffect(() => {
    const ch = supabase
      .channel("admin-chat-all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (p: any) => {
          qc.invalidateQueries({ queryKey: ["admin-chat-convs"] });
          if (p.new?.conversation_id === selected) {
            qc.invalidateQueries({ queryKey: ["admin-chat-msgs", selected] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected, qc]);

  useEffect(() => {
    if (!selected) return;
    supabase.rpc("mark_chat_read", { _conversation_id: selected, _as_admin: true }).then(() => {
      qc.invalidateQueries({ queryKey: ["admin-chat-convs"] });
    });
  }, [selected, messages.length, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!selected || !text.trim() || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc("admin_send_chat_message", {
      _conversation_id: selected,
      _content: text.trim(),
    });
    setSending(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.success) {
      toast.error(row?.message || error?.message || "Gagal");
      return;
    }
    setText("");
    qc.invalidateQueries({ queryKey: ["admin-chat-msgs", selected] });
    qc.invalidateQueries({ queryKey: ["admin-chat-convs"] });
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Live Chat</h1>
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 md:grid-cols-[20rem_1fr]">
        <div className="overflow-y-auto rounded-2xl border bg-card">
          {convs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Belum ada percakapan</p>
          ) : (
            convs.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  "w-full border-b p-3 text-left transition-colors hover:bg-muted",
                  selected === c.id && "bg-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  {c.unread_admin > 0 && (
                    <Badge className="h-5 min-w-[1.25rem] rounded-full p-0 text-[10px]">
                      {c.unread_admin}
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {c.last_message_preview || "(belum ada pesan)"}
                </p>
                {c.last_message_at && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(c.last_message_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="mb-2 h-10 w-10" />
              <p>Pilih percakapan</p>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.sender_role === "admin" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                        m.sender_role === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {m.content}
                      <p className="mt-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t p-3">
                <Input
                  placeholder="Balas pelanggan..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  maxLength={2000}
                />
                <Button onClick={send} disabled={sending || !text.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}