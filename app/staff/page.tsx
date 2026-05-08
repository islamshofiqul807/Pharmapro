"use client";
import { useState, useEffect } from "react";
import { Plus, Users, Shield, UserCheck, UserX, Mail, Clock, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/utils";
import { toast } from "@/hooks/use-toast";

type StaffMember = {
  id: string; name: string; email: string; role: string;
  status: string; invited_at: string; last_active: string | null;
  permissions: string[];
};

const ROLES = [
  { value: "manager", label: "Manager", label_bn: "ম্যানেজার", color: "bg-purple-100 text-purple-700", desc: "Full access except billing and staff management" },
  { value: "pharmacist", label: "Pharmacist", label_bn: "ফার্মাসিস্ট", color: "bg-blue-100 text-blue-700", desc: "Sales, inventory view, expiry alerts" },
  { value: "cashier", label: "Cashier", label_bn: "ক্যাশিয়ার", color: "bg-emerald-100 text-emerald-700", desc: "Sales only — no inventory editing" },
  { value: "viewer", label: "Viewer", label_bn: "দর্শক", color: "bg-gray-100 text-gray-700", desc: "Read-only access to all sections" },
];

const PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  manager:    ["sales", "inventory", "purchases", "suppliers", "customers", "reports", "expiry"],
  pharmacist: ["sales", "inventory", "expiry", "customers"],
  cashier:    ["sales", "customers"],
  viewer:     ["sales", "inventory", "reports", "expiry"],
};

const ALL_PERMISSIONS = [
  { key: "sales",      label: "Sales / বিক্রয়" },
  { key: "inventory",  label: "Inventory / ইনভেন্টরি" },
  { key: "purchases",  label: "Purchases / ক্রয়" },
  { key: "suppliers",  label: "Suppliers / সরবরাহকারী" },
  { key: "customers",  label: "Customers / গ্রাহক" },
  { key: "reports",    label: "Reports / রিপোর্ট" },
  { key: "expiry",     label: "Expiry / মেয়াদ" },
  { key: "analytics",  label: "Analytics / বিশ্লেষণ" },
];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyPlan, setPharmacyPlan] = useState("free");
  const [form, setForm] = useState({ name: "", email: "", role: "pharmacist", permissions: PERMISSIONS_BY_ROLE["pharmacist"] });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pharmacy } = await supabase.from("pharmacies").select("id, plan").eq("user_id", user!.id).single();
    if (!pharmacy) { setLoading(false); return; }
    setPharmacyId(pharmacy.id);
    setPharmacyPlan(pharmacy.plan);
    const { data } = await supabase.from("staff_members").select("*").eq("pharmacy_id", pharmacy.id).order("created_at");
    setStaff(data ?? []);
    setLoading(false);
  }

  function setRole(role: string) {
    setForm(p => ({ ...p, role, permissions: PERMISSIONS_BY_ROLE[role] ?? [] }));
  }

  function togglePerm(key: string) {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(key) ? p.permissions.filter(k => k !== key) : [...p.permissions, key]
    }));
  }

  async function invite() {
    if (!form.name || !form.email) return;
    if (pharmacyPlan === "free" && staff.length >= 1) {
      toast({ variant: "destructive", title: "Plan limit", description: "Upgrade to Pro to add more staff members." });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("staff_members").insert({
      pharmacy_id: pharmacyId, name: form.name, email: form.email,
      role: form.role, permissions: form.permissions,
      status: "invited", invited_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") toast({ variant: "destructive", title: "Already invited", description: "This email is already a staff member." });
      else toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Staff member invited!", description: `Invitation sent to ${form.email}` });
      setOpen(false);
      setForm({ name: "", email: "", role: "pharmacist", permissions: PERMISSIONS_BY_ROLE["pharmacist"] });
      fetchData();
    }
    setSaving(false);
  }

  async function toggleStatus(member: StaffMember) {
    const supabase = createClient();
    const newStatus = member.status === "active" ? "suspended" : "active";
    await supabase.from("staff_members").update({ status: newStatus }).eq("id", member.id);
    toast({ title: `Staff member ${newStatus === "active" ? "activated" : "suspended"}` });
    fetchData();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this staff member?")) return;
    const supabase = createClient();
    await supabase.from("staff_members").delete().eq("id", id);
    toast({ title: "Staff member removed" });
    fetchData();
  }

  const roleConfig = (role: string) => ROLES.find(r => r.value === role);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff <span className="text-muted-foreground font-normal text-lg">/ কর্মচারী</span></h1>
          <p className="text-sm text-muted-foreground">{staff.length} staff members · Manage access and roles</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Invite staff</Button>
      </div>

      {pharmacyPlan === "free" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">Free plan — 1 staff member limit</p>
            <p className="text-xs text-amber-700 mt-0.5">Upgrade to Pro (৳799/month) for unlimited staff, or Business (৳1,499/month) for advanced role management.</p>
          </div>
        </div>
      )}

      {/* Role overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map(r => (
          <Card key={r.value} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.label_bn}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
              <p className="text-xs font-medium mt-2">{staff.filter(s => s.role === r.value).length} member{staff.filter(s => s.role === r.value).length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No staff members yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Invite your pharmacists, cashiers, or managers</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Staff member</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Permissions</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map(member => {
                const rc = roleConfig(member.role);
                return (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</p>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc?.color ?? "bg-gray-100 text-gray-600"}`}>{rc?.label ?? member.role}</span>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(member.permissions ?? []).slice(0, 4).map(p => (
                          <span key={p} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{p}</span>
                        ))}
                        {(member.permissions ?? []).length > 4 && <span className="text-[10px] text-muted-foreground">+{(member.permissions ?? []).length - 4}</span>}
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        member.status === "active" ? "bg-emerald-100 text-emerald-700" :
                        member.status === "invited" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>{member.status}</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleStatus(member)}>
                          {member.status === "active" ? <><UserX className="h-3 w-3 mr-1" />Suspend</> : <><UserCheck className="h-3 w-3 mr-1" />Activate</>}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeMember(member.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Invite staff member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Full name *</Label><Input placeholder="Mohammad Karim" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email address *</Label><Input type="email" placeholder="staff@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${r.color}`}>{r.label}</span>
                        <span className="text-xs text-muted-foreground">{r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions (customize)</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm transition-colors ${form.permissions.includes(p.key) ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                    <input type="checkbox" className="accent-primary" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={invite} disabled={saving || !form.name || !form.email}>{saving ? "Inviting..." : "Send invitation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
