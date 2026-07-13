import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import {
  reportReferrals, reportOnService, reportActiveTracks, reportFollowUp, reportActivityLog,
  reportSourceConversion,
} from "@/lib/reports.functions";
import { sendMissingDocReminders, sendFollowUpDigest } from "@/lib/reminders.functions";
import { myRoles } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, BellRing } from "lucide-react";
import { toast } from "sonner";

const TABS = ["Referrals", "Source ROI", "On Service", "Active Tracks", "Follow Up Report", "Activity Log"] as const;
type Tab = (typeof TABS)[number];

const searchSchema = z.object({ tab: z.enum(TABS).optional().default("Referrals") });

export const Route = createFileRoute("/_authenticated/crm/reports")({
  validateSearch: (s) => searchSchema.parse(s),
  component: Reports,
});

function Reports() {
  const search = Route.useSearch();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-serif text-2xl">Reports</h1>
        <ReminderActions />
      </div>

      <div className="flex gap-1 border-b border-border flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t}
            to="/crm/reports"
            search={{ tab: t }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              search.tab === t ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-3 items-end">
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Date from</div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Date to</div>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[150px]" />
        </label>
      </div>

      {search.tab === "Referrals" && <ReferralsTab dateFrom={dateFrom} dateTo={dateTo} />}
      {search.tab === "Source ROI" && <SourceRoiTab dateFrom={dateFrom} dateTo={dateTo} />}
      {search.tab === "On Service" && <OnServiceTab dateFrom={dateFrom} dateTo={dateTo} />}
      {search.tab === "Active Tracks" && <ActiveTracksTab />}
      {search.tab === "Follow Up Report" && <FollowUpTab dateFrom={dateFrom} dateTo={dateTo} />}
      {search.tab === "Activity Log" && <ActivityLogTab dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  );
}

function ReferralsTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(reportReferrals);
  const { data } = useQuery({
    queryKey: ["reports", "referrals", dateFrom, dateTo],
    queryFn: () => fn({ data: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }),
  });
  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-4">
      <ReportTable
        rows={data?.rows ?? []}
        columns={[
          ["case_id", "Case #"], ["date_received", "Date Rec"],
          ["name", "Name"], ["ref_source", "Ref Source"], ["marketer", "Marketer"],
          ["workflow", "Workflow"], ["status", "Status"],
        ]}
      />
      <div className="rounded-lg border border-border bg-card p-4 h-fit space-y-3">
        <div className="text-sm font-semibold">Total Referrals</div>
        <div className="text-3xl font-bold text-primary">{data?.total ?? 0}</div>
        <div className="pt-2 border-t border-border">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">By Marketer</div>
          {Object.entries(data?.byMarketer ?? {}).map(([m, n]) => (
            <div key={m} className="flex justify-between text-sm py-0.5">
              <span className="truncate">{m}</span><span className="font-semibold">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnServiceTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(reportOnService);
  const { data } = useQuery({
    queryKey: ["reports", "on-service", dateFrom, dateTo],
    queryFn: () => fn({ data: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }),
  });
  return (
    <ReportTable
      rows={data?.rows ?? []}
      columns={[["case_id", "Case #"], ["date_received", "Date Rec"], ["name", "Name"], ["workflow", "Workflow"], ["status", "Status"], ["agent", "Agent"]]}
    />
  );
}

function ActiveTracksTab() {
  const fn = useServerFn(reportActiveTracks);
  const { data } = useQuery({ queryKey: ["reports", "active-tracks"], queryFn: () => fn({ data: {} }) });
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Object.entries(data?.stats ?? {}).map(([wf, statuses]) => {
        const count = Object.values(statuses).reduce((a, b) => a + b, 0);
        return (
          <div key={wf} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs font-semibold">{wf}</div>
            <div className="text-2xl font-bold mt-1">{count}</div>
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {Object.entries(statuses).map(([s, n]) => (
                <div key={s} className="flex justify-between gap-2"><span className="truncate">{s}</span><span className="font-semibold">{n}</span></div>
              ))}
            </div>
          </div>
        );
      })}
      {!Object.keys(data?.stats ?? {}).length && <div className="text-sm text-muted-foreground">No active tracks.</div>}
    </div>
  );
}

function FollowUpTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(reportFollowUp);
  const { data } = useQuery({
    queryKey: ["reports", "follow-up", dateFrom, dateTo],
    queryFn: () => fn({ data: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }),
  });
  return (
    <div className="space-y-3">
      {!!data?.overdueCount && (
        <div className="text-sm px-3 py-2 rounded-md bg-destructive/10 text-destructive font-medium">
          {data.overdueCount} overdue follow-up{data.overdueCount === 1 ? "" : "s"}
        </div>
      )}
      <ReportTable
        rows={(data?.rows ?? []).map((r) => ({ ...r, follow_up_date: r.overdue ? `⚠ ${r.follow_up_date}` : r.follow_up_date }))}
        columns={[["case_id", "Case #"], ["name", "Name"], ["follow_up_date", "Follow-up"], ["follow_count", "Count"], ["workflow", "Workflow"], ["agent", "Agent"]]}
      />
    </div>
  );
}

function ActivityLogTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(reportActivityLog);
  const { data = [] } = useQuery({
    queryKey: ["reports", "activity-log", dateFrom, dateTo],
    queryFn: () => fn({ data: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 200 } }),
  });
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase">
          <tr>
            <th className="p-2 text-left">When</th><th className="p-2 text-left">Case</th>
            <th className="p-2 text-left">Field</th><th className="p-2 text-left">Change</th><th className="p-2 text-left">By</th>
          </tr>
        </thead>
        <tbody>
          {data.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
              <td className="p-2">{e.case_name}</td>
              <td className="p-2 capitalize">{e.field.replace("_", " ")}</td>
              <td className="p-2 text-xs">{e.old_value ?? "—"} → {e.new_value ?? "—"}</td>
              <td className="p-2 text-xs text-muted-foreground">{e.actor_email ?? "system"}</td>
            </tr>
          ))}
          {!data.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No activity in range.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ReminderActions() {
  const me = useServerFn(myRoles);
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const docFn = useServerFn(sendMissingDocReminders);
  const digestFn = useServerFn(sendFollowUpDigest);
  const [busy, setBusy] = useState<"docs" | "digest" | null>(null);
  if (!roles?.isAdmin) return null;
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={busy !== null}
        onClick={async () => {
          if (!confirm("Email every client with an incomplete document checklist?")) return;
          setBusy("docs");
          try {
            const r = await docFn();
            toast.success(`Reminders sent: ${r.sent} · ${r.complete} already complete · ${r.skipped} skipped`);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
        }}>
        <Mail className="h-3.5 w-3.5 mr-1.5" /> {busy === "docs" ? "Sending…" : "Send doc reminders"}
      </Button>
      <Button size="sm" variant="outline" disabled={busy !== null}
        onClick={async () => {
          setBusy("digest");
          try {
            const r = await digestFn();
            toast.success(r.count ? `Digest of ${r.count} overdue follow-up(s) emailed to you` : "No overdue follow-ups 🎉");
          } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
        }}>
        <BellRing className="h-3.5 w-3.5 mr-1.5" /> {busy === "digest" ? "Sending…" : "Email me overdue follow-ups"}
      </Button>
    </div>
  );
}

function SourceRoiTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(reportSourceConversion);
  const { data } = useQuery({
    queryKey: ["reports", "source-roi", dateFrom, dateTo],
    queryFn: () => fn({ data: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }),
  });
  const buckets = data?.buckets ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total leads" value={data?.totals.total ?? 0} />
        <Stat label="Won" value={data?.totals.won ?? 0} accent="text-emerald-600" />
        <Stat label="In progress" value={data?.totals.inProgress ?? 0} />
        <Stat label="Overall conversion" value={`${data?.conversion ?? 0}%`} accent="text-primary" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Source</th><th className="p-2 text-left">Total</th>
              <th className="p-2 text-left">Won</th><th className="p-2 text-left">Lost</th>
              <th className="p-2 text-left">In progress</th><th className="p-2 text-left">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.source} className="border-t border-border">
                <td className="p-2 font-medium">{b.source}</td>
                <td className="p-2">{b.total}</td>
                <td className="p-2 text-emerald-600">{b.won}</td>
                <td className="p-2 text-muted-foreground">{b.lost}</td>
                <td className="p-2">{b.inProgress}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${b.conversion}%` }} />
                    </div>
                    <span className="tabular-nums text-xs">{b.conversion}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {!buckets.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No leads in range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function ReportTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase">
          <tr>{columns.map(([, label]) => <th key={label} className="p-2 text-left">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.id as string) ?? i} className="border-t border-border">
              {columns.map(([key, label]) => (
                <td key={label} className="p-2">
                  {key === "name" ? `${r.last_name ?? ""}, ${r.first_name ?? ""}`.trim() : String(r[key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length} className="p-6 text-center text-muted-foreground">No results.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
