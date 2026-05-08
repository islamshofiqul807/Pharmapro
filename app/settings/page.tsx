"use client";
import { useState, useEffect } from "react";
import { Settings, Save, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SMSAlertsPanel } from "@/components/features/sms-alerts";

const TABS = [
  { key: "profile", label: "Pharmacy Profile", icon: Settings },
  { key: "alerts", label: "SMS Alerts", icon: Bell },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState({ name: "", owner_name: "", phone: "", address: "", license_no: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
      const { data: pharmacy } = await supabase.from("pharmacies").select("*").eq("user_id", user!.id).single();
      if (pharmacy) {
        setPharmacyId(pharmacy.id);
        setForm({ name: pharmacy.name ?? "", owner_name: pharmacy.owner_name ?? "", phone: pharmacy.phone ?? "", address: pharmacy.address ?? "", license_no: pharmacy.license_no ?? "" });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("pharmacies").update(form).eq("id", pharmacyId);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Settings saved!" });
    setSaving(false);
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings <span className="text-muted-foreground font-normal text-lg">/ সেটিংস</span></h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your pharmacy and account</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" />Pharmacy information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5"><Label>Pharmacy name *</Label><Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="Al-Amin Pharmacy" /></div>
                <div className="space-y-1.5"><Label>Owner name</Label><Input value={form.owner_name} onChange={e => f("owner_name", e.target.value)} placeholder="Mohammad Karim" /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="01XXXXXXXXX" /></div>
                <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => f("address", e.target.value)} placeholder="Dhaka, Bangladesh" /></div>
                <div className="space-y-1.5"><Label>Drug license number</Label><Input value={form.license_no} onChange={e => f("license_no", e.target.value)} placeholder="License no." /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Account</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5"><Label>Email address</Label><Input value={email} disabled className="bg-muted" /></div>
                <p className="text-xs text-muted-foreground">To change your email or password, contact support.</p>
              </CardContent>
            </Card>
            <Button onClick={save} disabled={saving || !form.name} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </>
        )
      )}

      {tab === "alerts" && <SMSAlertsPanel />}
    </div>
  );
}
