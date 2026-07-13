import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listSupportThreads, getSupportThread, staffReply,
  listDmThreads, getDmThread, sendDm, listDmContacts,
  listAnnouncements, postAnnouncement,
  type ChatMessage, type ThreadSummary,
} from "@/lib/messages.functions";
import { myRoles } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Megaphone, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/messages")({
  component: Messages,
});

type TabKey = "support" | "team" | "announcements";

function Messages() {
  const [tab, setTab] = useState<TabKey>("support");
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Messages</h1>
      <div className="flex gap-1 border-b border-border">
        {([
          ["support", "Client Support", MessageSquare],
          ["team", "Team", Users],
          ["announcements", "Announcements", Megaphone],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-1.5 ${
              tab === key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {tab === "support" && <SupportTab />}
      {tab === "team" && <TeamTab />}
      {tab === "announcements" && <AnnouncementsTab />}
    </div>
  );
}

function ChatWindow({
  messages, onSend, emptyHint,
}: { messages: ChatMessage[]; onSend: (body: string) => Promise<void>; emptyHint: string }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col h-[60vh] border border-border rounded-lg bg-card">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && <div className="text-sm text-muted-foreground text-center py-10">{emptyHint}</div>}
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
          try { await onSend(body); setDraft(""); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
        }}
      >
        <Textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…" className="resize-none min-h-9"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function ThreadList({
  threads, activeId, onPick,
}: { threads: ThreadSummary[]; activeId: string | null; onPick: (t: ThreadSummary) => void }) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-y-auto h-[60vh] divide-y divide-border">
      {threads.length === 0 && <div className="text-sm text-muted-foreground p-4">No conversations yet.</div>}
      {threads.map((t) => (
        <button key={t.thread_id} onClick={() => onPick(t)}
          className={`w-full text-left p-3 hover:bg-muted/50 ${activeId === t.other_id ? "bg-muted" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{t.name ?? t.other_id.slice(0, 8)}</span>
            {t.unread > 0 && <Badge className="bg-amber-500">{t.unread}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate">{t.last_body}</div>
        </button>
      ))}
    </div>
  );
}

function SupportTab() {
  const listFn = useServerFn(listSupportThreads);
  const threadFn = useServerFn(getSupportThread);
  const replyFn = useServerFn(staffReply);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["messages", "support-threads"], queryFn: () => listFn(), refetchInterval: 20_000 });
  const [active, setActive] = useState<string | null>(null);
  const { data: msgs } = useQuery({
    queryKey: ["messages", "support", active],
    queryFn: () => threadFn({ data: { client_user_id: active! } }),
    enabled: !!active,
    refetchInterval: 10_000,
  });

  if (data && !data.available) return <Unavailable />;
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-3">
      <ThreadList threads={data?.threads ?? []} activeId={active} onPick={(t) => setActive(t.other_id)} />
      {active ? (
        <ChatWindow
          messages={msgs ?? []}
          emptyHint="No messages in this conversation yet."
          onSend={async (body) => {
            await replyFn({ data: { client_user_id: active, body } });
            qc.invalidateQueries({ queryKey: ["messages", "support", active] });
            qc.invalidateQueries({ queryKey: ["messages", "support-threads"] });
          }}
        />
      ) : (
        <div className="border border-border rounded-lg bg-card flex items-center justify-center h-[60vh] text-sm text-muted-foreground">
          Select a client conversation.
        </div>
      )}
    </div>
  );
}

function TeamTab() {
  const listFn = useServerFn(listDmThreads);
  const contactsFn = useServerFn(listDmContacts);
  const threadFn = useServerFn(getDmThread);
  const sendFn = useServerFn(sendDm);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["messages", "dm-threads"], queryFn: () => listFn(), refetchInterval: 20_000 });
  const { data: contacts } = useQuery({ queryKey: ["messages", "dm-contacts"], queryFn: () => contactsFn() });
  const [active, setActive] = useState<string | null>(null);
  const { data: msgs } = useQuery({
    queryKey: ["messages", "dm", active],
    queryFn: () => threadFn({ data: { other_user_id: active! } }),
    enabled: !!active,
    refetchInterval: 10_000,
  });

  if (data && !data.available) return <Unavailable />;
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-3">
      <div className="space-y-3">
        <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value="" onChange={(e) => { if (e.target.value) setActive(e.target.value); }}>
          <option value="">Start a chat with…</option>
          {(contacts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
        </select>
        <ThreadList threads={data?.threads ?? []} activeId={active} onPick={(t) => setActive(t.other_id)} />
      </div>
      {active ? (
        <ChatWindow
          messages={msgs ?? []}
          emptyHint="No messages yet. Say hello."
          onSend={async (body) => {
            await sendFn({ data: { other_user_id: active, body } });
            qc.invalidateQueries({ queryKey: ["messages", "dm", active] });
            qc.invalidateQueries({ queryKey: ["messages", "dm-threads"] });
          }}
        />
      ) : (
        <div className="border border-border rounded-lg bg-card flex items-center justify-center h-[60vh] text-sm text-muted-foreground">
          Pick a teammate to start chatting.
        </div>
      )}
    </div>
  );
}

function AnnouncementsTab() {
  const listFn = useServerFn(listAnnouncements);
  const postFn = useServerFn(postAnnouncement);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const { data: list } = useQuery({ queryKey: ["announcements"], queryFn: () => listFn() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;
  const [form, setForm] = useState({ audience: "all" as "all" | "staff" | "clients", title: "", body: "" });
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {isAdmin && (
        <form
          className="rounded-lg border border-border bg-card p-4 space-y-3 h-fit"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await postFn({ data: { audience: form.audience, title: form.title.trim(), body: form.body.trim() } });
              toast.success("Announcement posted");
              setForm({ audience: "all", title: "", body: "" });
              qc.invalidateQueries({ queryKey: ["announcements"] });
            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
          }}
        >
          <div className="text-sm font-semibold">Post an announcement</div>
          <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as typeof f.audience }))}>
            <option value="all">Everyone</option>
            <option value="staff">Staff only</option>
            <option value="clients">Clients only</option>
          </select>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          <Textarea rows={4} placeholder="Message…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
          <Button type="submit" disabled={busy || !form.title.trim() || !form.body.trim()}>
            <Megaphone className="h-4 w-4 mr-2" /> {busy ? "Posting…" : "Post"}
          </Button>
        </form>
      )}
      <div className={`space-y-3 ${isAdmin ? "" : "md:col-span-2"}`}>
        {(list ?? []).map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{a.title}</div>
              <Badge variant="outline" className="capitalize">{a.audience}</Badge>
            </div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{a.body}</div>
            <div className="text-xs text-muted-foreground mt-2">
              {a.author_name ?? "Admin"} · {new Date(a.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!(list ?? []).length && <div className="text-sm text-muted-foreground">No announcements yet.</div>}
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      Messaging isn't available yet — the <code className="text-xs">messages</code> migration needs to be applied
      (sync migrations via Lovable).
    </div>
  );
}
