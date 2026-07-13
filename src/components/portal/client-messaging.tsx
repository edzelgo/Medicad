import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyThread, sendMyMessage, listAnnouncements } from "@/lib/messages.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Megaphone } from "lucide-react";
import { toast } from "sonner";

/** Broadcast announcements visible to this client (audience all/clients). */
export function ClientAnnouncements() {
  const listFn = useServerFn(listAnnouncements);
  const { data } = useQuery({ queryKey: ["announcements"], queryFn: () => listFn(), refetchInterval: 60_000 });
  const items = data ?? [];
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      {items.slice(0, 3).map((a) => (
        <div key={a.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <Megaphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{a.title}</div>
            <div className="text-sm mt-0.5 whitespace-pre-wrap">{a.body}</div>
            <div className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Secure two-way chat between the client and their specialist. */
export function ClientMessages() {
  const threadFn = useServerFn(getMyThread);
  const sendFn = useServerFn(sendMyMessage);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-thread"], queryFn: () => threadFn(), refetchInterval: 15_000 });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  if (data && !data.available) return null; // messaging migration not applied yet
  const messages = data?.messages ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-7">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Messages</span>
      <h2 className="font-serif text-2xl mt-1 mb-4">Talk to your specialist</h2>
      <div className="flex flex-col h-[380px] border border-border rounded-lg bg-background">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-10">
              No messages yet. Send us a question and your specialist will reply here.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-[10px] mt-1 ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form
          className="border-t border-border p-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            setBusy(true);
            try {
              await sendFn({ data: { body } });
              setDraft("");
              qc.invalidateQueries({ queryKey: ["my-thread"] });
            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send"); } finally { setBusy(false); }
          }}
        >
          <Textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…" className="resize-none min-h-9"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </section>
  );
}
