import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Lock } from "lucide-react";
import { chatWithSupport } from "@/lib/chatbot.functions";
import ReactMarkdown from "react-markdown";

type Role = "client" | "agent" | "referral";
type Msg = { role: "user" | "assistant"; content: string };

const ROLE_CONFIG: Record<Role, { label: string; greeting: string; color: string; accent: string }> = {
  client: {
    label: "Client Support",
    greeting: "Hi! I'm here to help you with your Medicaid application. I can answer questions about documents, eligibility, and what to expect at each step. What can I help you with?",
    color: "#1e3a5f",
    accent: "#e8f0fa",
  },
  agent: {
    label: "Agent Support",
    greeting: "Welcome back! I can help with producer onboarding, licensing requirements, E&O docs, and tracking your referral pipeline. What do you need?",
    color: "#0f1b3d",
    accent: "#d6e0eb",
  },
  referral: {
    label: "Partner Support",
    greeting: "Hello! I'm here to support your referral partnership — patient packet submissions, partner agreements, and case status updates. How can I help?",
    color: "#3b6fa0",
    accent: "#e8f0fa",
  },
};

export function SupportChatbot({ role = "client" }: { role?: Role }) {
  const config = ROLE_CONFIG[role];
  const chatFn = useServerFn(chatWithSupport);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: config.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const updated: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const apiMessages = updated.slice(1); // drop greeting
      const res = await chatFn({ data: { role, messages: apiMessages } });
      setMessages([...updated, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages([...updated, { role: "assistant", content: (e as Error).message || "I'm having trouble connecting right now. Please try again or contact your specialist directly." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        style={{ background: config.color }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white border-0 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.18)] flex items-center justify-center z-[9999] transition-transform hover:scale-110"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden"
          role="dialog"
          aria-label={`${config.label} chat`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 text-white" style={{ background: config.color }}>
            <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-base leading-tight">Medicaid Success</div>
              <div className="text-[11px] opacity-90">{config.label} · Online</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed chatbot-md"
                    style={
                      isUser
                        ? { background: config.color, color: "#fff", borderBottomRightRadius: 4 }
                        : { background: config.accent, color: "#1a1a1a", borderBottomLeftRadius: 4 }
                    }
                  >
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    ) : (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 flex gap-1" style={{ background: config.accent }}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: config.color,
                        animation: `chatbot-bounce 1.2s ${d * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* HIPAA notice */}
          <div className="px-4 py-2 text-[11px] text-muted-foreground bg-secondary/50 border-t border-border flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> This chat does not transmit personal health information.
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              rows={1}
              className="flex-1 resize-none border border-input rounded-lg px-3 py-2 text-sm outline-none bg-background text-foreground focus:border-ring max-h-24 overflow-y-auto"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              style={{ background: input.trim() && !loading ? config.color : undefined }}
              className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <style>{`
            @keyframes chatbot-bounce { 0%,60%,100% { transform: translateY(0); opacity:.6 } 30% { transform: translateY(-4px); opacity:1 } }
            .chatbot-md p { margin: 0 0 0.5em; }
            .chatbot-md p:last-child { margin-bottom: 0; }
            .chatbot-md h1, .chatbot-md h2, .chatbot-md h3, .chatbot-md h4 { font-weight: 700; margin: 0.4em 0 0.3em; font-size: 1em; }
            .chatbot-md ul, .chatbot-md ol { margin: 0.3em 0; padding-left: 1.2em; }
            .chatbot-md li { margin: 0.15em 0; }
            .chatbot-md strong { font-weight: 700; }
            .chatbot-md code { background: rgba(0,0,0,0.06); padding: 0 0.25em; border-radius: 3px; font-size: 0.9em; }
            .chatbot-md a { text-decoration: underline; }
          `}</style>
        </div>
      )}
    </>
  );
}