import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { mergeUserDocuments, getSignedDownloadUrl } from "@/lib/portal.functions";
import { analyzeEligibility } from "@/lib/eligibility.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ReadabilityToggle } from "@/components/readability-toggle";
import { SupportChatbot } from "@/components/support-chatbot";
import { toast } from "sonner";
import {
  Upload, FileText, Trash2, Download, FilePlus2, Combine, LogOut,
  CheckCircle2, Circle, Clock, Sparkles, ChevronRight, ClipboardList, Brain, AlertTriangle, XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MAX_FILES = 200;
const MAX_FILE_MB = 25;

// Standard documents an individual must submit for a long-term care
// Medicaid application. Each item lists keyword patterns we match against
// the names of uploaded documents to auto-check the box.
const REQUIRED_DOCUMENTS: { label: string; hint: string; match: RegExp }[] = [
  { label: "Government-issued photo ID",       hint: "Driver's license, state ID, or passport",                              match: /(\bid\b|driver|license|passport|state[\s_-]?id)/i },
  { label: "Social Security card",             hint: "Applicant and spouse if married",                                      match: /(social|ssn|ss[\s_-]?card)/i },
  { label: "Medicare card",                    hint: "Front and back",                                                       match: /medicare/i },
  { label: "Birth certificate",                hint: "Proof of age and citizenship",                                         match: /(birth|certificate)/i },
  { label: "Marriage certificate",             hint: "If currently or previously married",                                   match: /(marriage|marri)/i },
  { label: "Proof of income (last 3 months)",  hint: "Social Security, pension, annuity, or wage statements",                match: /(income|pension|wage|paystub|pay[\s_-]?stub|annuity|ssa)/i },
  { label: "Bank statements (last 60 months)", hint: "All checking, savings, and money-market accounts",                     match: /(bank|checking|savings|statement)/i },
  { label: "Life insurance policies",          hint: "Declaration page and cash-value statement",                            match: /(life[\s_-]?insurance|policy)/i },
  { label: "Health insurance card",            hint: "Any supplemental or long-term care coverage",                          match: /(health[\s_-]?insurance|insurance[\s_-]?card|supplement)/i },
  { label: "Deed / mortgage statement",        hint: "Required if you own real property",                                    match: /(deed|mortgage|property|real[\s_-]?estate)/i },
  { label: "Vehicle title or registration",    hint: "For every vehicle owned",                                              match: /(title|registration|vehicle|auto)/i },
  { label: "Burial / funeral contract",        hint: "Prepaid burial or funeral arrangements, if any",                       match: /(burial|funeral|cemetery)/i },
  { label: "Power of attorney",                hint: "Financial or healthcare POA documents",                                 match: /(power[\s_-]?of[\s_-]?attorney|poa)/i },
  { label: "Medical / facility records",       hint: "Admission paperwork or physician's level-of-care assessment",          match: /(medical|physician|admission|facility|level[\s_-]?of[\s_-]?care)/i },
];

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Your Portal — Medicaid Success" }] }),
  component: PortalPage,
});

type Doc = { id: string; name: string; storage_path: string; mime_type: string | null; size_bytes: number | null; created_at: string };
type CheckIn = { id: string; title: string; body: string | null; status: string; created_at: string };
type Task = { id: string; title: string; description: string | null; status: string; sort_order: number; completed_at: string | null };

function PortalPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? null);
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      setProfile(p ?? { full_name: null });
      setRole((r?.role as string) ?? null);
    })();
  }, []);

  const docsQ = useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, storage_path, mime_type, size_bytes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkInsQ = useQuery({
    queryKey: ["check_ins"],
    queryFn: async (): Promise<CheckIn[]> => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("id, title, body, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, status, sort_order, completed_at")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const docs = docsQ.data ?? [];
  const checkIns = checkInsQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Compute which required documents have at least one matching upload.
  const requirementsState = REQUIRED_DOCUMENTS.map((req) => ({
    ...req,
    satisfied: docs.some((d) => req.match.test(d.name)),
  }));
  const requirementsDone = requirementsState.filter((r) => r.satisfied).length;
  const requirementsPct = Math.round((requirementsDone / REQUIRED_DOCUMENTS.length) * 100);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (docs.length + files.length > MAX_FILES) {
      toast.error(`You can upload up to ${MAX_FILES} files total. You have ${docs.length}.`);
      return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    let success = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_FILE_MB}MB`);
        setUploadProgress({ done: i + 1, total: files.length });
        continue;
      }
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${i}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) { toast.error(`${f.name}: ${upErr.message}`); setUploadProgress({ done: i + 1, total: files.length }); continue; }
      const { error: insErr } = await supabase.from("documents").insert({
        user_id: user.id, name: f.name, storage_path: path, mime_type: f.type || null, size_bytes: f.size,
      });
      if (insErr) toast.error(`${f.name}: ${insErr.message}`);
      else success++;
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    if (success > 0) toast.success(`Uploaded ${success} file${success === 1 ? "" : "s"}.`);
    qc.invalidateQueries({ queryKey: ["documents"] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const deleteDoc = useMutation({
    mutationFn: async (d: Doc) => {
      await supabase.storage.from("documents").remove([d.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("File removed."); qc.invalidateQueries({ queryKey: ["documents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeFn = useServerFn(mergeUserDocuments);
  const signedFn = useServerFn(getSignedDownloadUrl);
  const analyzeFn = useServerFn(analyzeEligibility);
  const merge = useMutation({
    mutationFn: async () => mergeFn(),
    onSuccess: (res) => {
      toast.success(`Packet ready — ${res.count} file${res.count === 1 ? "" : "s"} merged.`);
      window.open(res.url, "_blank");
      qc.invalidateQueries({ queryKey: ["check_ins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analyze = useMutation({
    mutationFn: async () => analyzeFn(),
    onSuccess: () => {
      toast.success("Eligibility analysis ready.");
      qc.invalidateQueries({ queryKey: ["check_ins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async (t: Task) => {
      const next = t.status === "done" ? "pending" : "done";
      const { error } = await supabase.from("tasks").update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  async function download(d: Doc) {
    try {
      const res = await signedFn({ data: { path: d.storage_path } });
      window.open(res.url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "client" as const }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-[var(--gradient-emerald)]" />
            <div>
              <div className="font-serif text-base leading-tight">Medicaid Success</div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {role ? `${role} portal` : "portal"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:block text-right">
              <div className="font-medium">{profile?.full_name ?? email}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
            <ReadabilityToggle />
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4 mr-2" aria-hidden="true" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-10 space-y-10">
        {/* Hero summary */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl p-8 bg-card border border-border shadow-[var(--shadow-elegant)] text-black">
            <span className="text-xs uppercase tracking-[0.18em] font-semibold text-black">Your case</span>
            <h1 className="font-serif text-3xl mt-2 font-bold text-black">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 max-w-xl text-black">
              You've uploaded <span className="font-bold text-black">{docs.length}</span> of {MAX_FILES} files. Your specialist will review every document and post a check-in as your case progresses.
            </p>
            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 text-black">
                <span>Onboarding progress</span><span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-[var(--emerald)] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">One-click packet</span>
            <h2 className="font-serif text-2xl mt-2">Compile everything</h2>
            <p className="text-sm text-muted-foreground mt-2 flex-1">Merge every uploaded document into a single, indexed PDF — ready to download and submit.</p>
            <Button className="mt-5" disabled={merge.isPending || docs.length === 0} onClick={() => merge.mutate()}>
              <Combine className="h-4 w-4 mr-2" />
              {merge.isPending ? "Compiling…" : docs.length === 0 ? "Upload files to compile" : `Merge ${docs.length} file${docs.length === 1 ? "" : "s"} → PDF`}
            </Button>
          </div>
        </section>

        {/* Tasks + Check-ins */}
        <section className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-xl border border-border bg-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Action checklist</span>
                <h2 className="font-serif text-2xl mt-1">What we'll do for you</h2>
              </div>
              <span className="text-sm text-muted-foreground">{completedTasks} / {tasks.length} complete</span>
            </div>
            <ul className="mt-6 divide-y divide-border">
              {tasks.map((t) => {
                const done = t.status === "done";
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggleTask.mutate(t)}
                      className="w-full text-left flex items-start gap-3 py-4 group"
                    >
                      {done
                        ? <CheckCircle2 className="h-5 w-5 mt-0.5 text-[var(--emerald)] shrink-0" />
                        : <Circle className="h-5 w-5 mt-0.5 text-muted-foreground/50 group-hover:text-foreground shrink-0" />}
                      <div className="flex-1">
                        <div className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                        {t.description && <div className="text-sm text-muted-foreground mt-0.5">{t.description}</div>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1" />
                    </button>
                  </li>
                );
              })}
              {tasks.length === 0 && <li className="py-6 text-sm text-muted-foreground">No tasks yet.</li>}
            </ul>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-7">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Check-ins</span>
            <h2 className="font-serif text-2xl mt-1">Status timeline</h2>
            <ol className="mt-6 space-y-5 border-l border-border ml-2 pl-5">
              {checkIns.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-card" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />{new Date(c.created_at).toLocaleString()}
                  </div>
                  <div className="font-medium mt-1">{c.title}</div>
                  {c.body && <p className="text-sm text-muted-foreground mt-1">{c.body}</p>}
                </li>
              ))}
              {checkIns.length === 0 && <li className="text-sm text-muted-foreground">No check-ins yet.</li>}
            </ol>
          </div>
        </section>

        {/* AI Eligibility Analyzer */}
        <section className="rounded-xl border border-border bg-card p-7">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-[var(--gradient-emerald)] flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI document review</span>
                <h2 className="font-serif text-2xl mt-1">Check my Medicaid eligibility</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  Our AI reads every document you've uploaded and gives you a plain-language eligibility estimate. This is a screening, not a final decision — your specialist confirms the result.
                </p>
              </div>
            </div>
            <Button onClick={() => analyze.mutate()} disabled={analyze.isPending || docs.length === 0}>
              <Brain className="h-4 w-4 mr-2" />
              {analyze.isPending ? "Analyzing…" : docs.length === 0 ? "Upload files first" : "Run eligibility check"}
            </Button>
          </div>

          {analyze.data && (
            <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                {analyze.data.verdict === "eligible" && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--emerald)]">
                    <CheckCircle2 className="h-4 w-4" /> Likely Eligible
                  </span>
                )}
                {analyze.data.verdict === "needs_info" && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> More Information Needed
                  </span>
                )}
                {analyze.data.verdict === "ineligible" && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
                    <XCircle className="h-4 w-4" /> Likely Ineligible
                  </span>
                )}
                <span className="text-xs text-muted-foreground">· {analyze.data.totalDocs} document{analyze.data.totalDocs === 1 ? "" : "s"} reviewed</span>
              </div>
              <div className="prose prose-sm max-w-none text-foreground">
                <ReactMarkdown>{analyze.data.report}</ReactMarkdown>
              </div>
            </div>
          )}
        </section>

        {/* Documents */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Required documents checklist */}
          <div className="p-7 border-b border-border bg-secondary/30">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-[var(--gradient-emerald)] flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Required documents</span>
                  <h2 className="font-serif text-2xl mt-1">Your Medicaid application checklist</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    Upload the items below so your specialist can build your application. Each box checks itself once a matching file appears in your vault.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-serif text-primary">{requirementsDone}<span className="text-muted-foreground text-base"> / {REQUIRED_DOCUMENTS.length}</span></div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Submitted</div>
              </div>
            </div>
            <div className="mt-5">
              <Progress value={requirementsPct} aria-label="Required documents progress" />
            </div>
            <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {requirementsState.map((r) => (
                <li key={r.label} className="flex items-start gap-3">
                  {r.satisfied
                    ? <CheckCircle2 className="h-5 w-5 mt-0.5 text-[var(--emerald)] shrink-0" aria-label="Submitted" />
                    : <Circle className="h-5 w-5 mt-0.5 text-muted-foreground/50 shrink-0" aria-label="Not yet submitted" />}
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${r.satisfied ? "text-foreground" : "text-foreground"}`}>{r.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.hint}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-7 border-b border-border flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Documents</span>
              <h2 className="font-serif text-2xl mt-1">Your secure document vault</h2>
              <p className="text-sm text-muted-foreground mt-1">PDFs, images, and scans. Up to {MAX_FILES} files, {MAX_FILE_MB}MB each.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.heic,.tif,.tiff,.doc,.docx,image/*,application/pdf"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <FilePlus2 className="h-4 w-4 mr-2" />{uploading ? "Uploading…" : "Upload files"}
              </Button>
            </div>
          </div>

          {uploading && (
            <div className="px-7 py-4 border-b border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Uploading {uploadProgress.done} of {uploadProgress.total}</span>
              </div>
              <Progress value={uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0} />
            </div>
          )}

          {docs.length === 0 ? (
            <DropZone onFiles={handleFiles} disabled={uploading} />
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-4 p-4 px-7 hover:bg-secondary/40 transition">
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[var(--emerald)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteDoc.mutate(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="text-center text-xs text-muted-foreground py-6 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" /> Files are encrypted in transit and at rest. Only you and your specialist can access them.
        </div>
      </main>
      <SupportChatbot role={(role === "agent" || role === "referral") ? role : "client"} />
    </div>
  );
}

function DropZone({ onFiles, disabled }: { onFiles: (f: FileList) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(e.dataTransfer.files); }}
      className={`m-7 rounded-lg border-2 border-dashed transition flex flex-col items-center justify-center text-center py-16 px-6 ${
        over ? "border-accent bg-accent/5" : "border-border bg-secondary/30"
      }`}
    >
      <div className="h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center mb-4">
        <Upload className="h-5 w-5 text-[var(--emerald)]" />
      </div>
      <div className="font-serif text-xl">Drop your documents here</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">PDFs, images, and scans. We'll keep them safe and compile them into a single packet when you're ready.</p>
    </div>
  );
}

function formatBytes(b: number | null) {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}