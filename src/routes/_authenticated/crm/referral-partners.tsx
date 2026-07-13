import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listReferralOrgs, addReferralOrg, updateReferralOrg, ORG_TYPES, type ReferralOrg,
} from "@/lib/referrals.functions";
import { myRoles } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/referral-partners")({
  component: ReferralPartners,
});

function ReferralPartners() {
  const listFn = useServerFn(listReferralOrgs);
  const addFn = useServerFn(addReferralOrg);
  const updateFn = useServerFn(updateReferralOrg);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", "referral-orgs"], queryFn: () => listFn() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;
  const editable = !!data?.editable && isAdmin;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", org_type: "", contact_name: "", contact_email: "", contact_phone: "", notes: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "referral-orgs"] });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Referral Partners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Structured partner records (facilities, attorneys, agencies) you can attach to leads and report on.
          </p>
        </div>
        {editable && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add partner</Button>}
      </div>

      {data && !data.editable && (
        <p className="text-sm text-muted-foreground">
          Referral partners aren't available until the <code className="text-xs">referral_orgs</code> migration is applied
          (sync migrations via Lovable).
        </p>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th><th className="text-left p-3">Type</th>
              <th className="text-left p-3">Contact</th><th className="text-left p-3">Status</th>
              {isAdmin && <th className="text-left p-3"></th>}
            </tr>
          </thead>
          <tbody>
            {(data?.orgs ?? []).map((o: ReferralOrg) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{o.name}</div>
                </td>
                <td className="p-3">{o.org_type ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {o.contact_name ?? "—"}
                  {o.contact_email ? <div className="text-xs">{o.contact_email}</div> : null}
                  {o.contact_phone ? <div className="text-xs">{o.contact_phone}</div> : null}
                </td>
                <td className="p-3">
                  <Badge variant={o.active ? "default" : "outline"}>{o.active ? "active" : "inactive"}</Badge>
                </td>
                {isAdmin && (
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        await updateFn({ data: { id: o.id, patch: { active: !o.active } } });
                        toast.success(o.active ? "Deactivated" : "Reactivated");
                        refresh();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>{o.active ? "Deactivate" : "Reactivate"}</Button>
                  </td>
                )}
              </tr>
            ))}
            {!(data?.orgs ?? []).length && (
              <tr><td colSpan={isAdmin ? 5 : 4} className="p-6 text-center text-muted-foreground">No referral partners yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add referral partner</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await addFn({ data: {
                  name: form.name.trim(),
                  org_type: (form.org_type || undefined) as typeof ORG_TYPES[number] | undefined,
                  contact_name: form.contact_name || undefined,
                  contact_email: form.contact_email || undefined,
                  contact_phone: form.contact_phone || undefined,
                  notes: form.notes || undefined,
                } });
                toast.success("Referral partner added");
                setOpen(false);
                setForm({ name: "", org_type: "", contact_name: "", contact_email: "", contact_phone: "", notes: "" });
                refresh();
              } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
            }}
          >
            <div className="space-y-1"><Label className="text-xs">Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Type</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.org_type} onChange={(e) => setForm((f) => ({ ...f, org_type: e.target.value }))}>
                <option value="">—</option>
                {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Contact name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Contact email</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Contact phone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={busy || !form.name.trim()}>{busy ? "Saving…" : "Add partner"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
