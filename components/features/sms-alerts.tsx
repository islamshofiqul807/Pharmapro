"use client";
import { useState, useEffect } from "react";
import { Bell, Send, CheckCircle2, XCircle, Phone, AlertTriangle, Package, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/utils";
import { toast } from "@/hooks/use-toast";

type AlertLog = { id: string; type: string; status: string; recipient: string; created_at: string; };

export function SMSAlertsPanel() {
  const [phone, setPhone] = useState("");
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pharmacy } = await supabase.from("pharmacies").select("id, phone").eq("user_id", user!.id).single();
      if (pharmacy) { setPharmacyId(pharmacy.id); setPhone(pharmacy.phone ?? ""); }
      const { data: logData } = await supabase.from("alert_logs").select("*").eq("pharmacy_id", pharmacy?.id ?? "").order("created_at", { ascending: false }).limit(20);
      setLogs(logData ?? []);
      setLoading(false);
    })();
  }, []);

  async function savePhone() {
    const supabase = createClient();
    await supabase.from("pharmacies").update({ phone }).eq("id", pharmacyId);
    toast({ title: "Phone number saved" });
  }

  async function sendAlert(type: "low_stock" | "expiry" | "test") {
    setSending(type);
    try {
      const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
      const data = await res.json();
      if (data.success) toast({ title: "Alert sent!", description: data.message });
      else toast({ variant: "destructive", title: "Failed", description: data.message ?? data.error });
      // Refresh logs
      const supabase = createClient();
      const { data: logData } = await supabase.from("alert_logs").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(20);
      setLogs(logData ?? []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
    setSending(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" />Alert phone number</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} className="flex-1" />
            <Button onClick={savePhone} variant="outline">Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">SMS alerts will be sent to this number. Configure SMS_API_KEY in your environment for real SMS delivery.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Send alerts manually</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { type: "test" as const, label: "Send test SMS", icon: Send, desc: "Verify your SMS setup", color: "bg-blue-50 border-blue-200 text-blue-700" },
              { type: "low_stock" as const, label: "Low stock alert", icon: Package, desc: "Alert for medicines below reorder level", color: "bg-amber-50 border-amber-200 text-amber-700" },
              { type: "expiry" as const, label: "Expiry alert", icon: AlertTriangle, desc: "Alert for medicines expiring in 90 days", color: "bg-red-50 border-red-200 text-red-700" },
            ].map(btn => (
              <button key={btn.type} onClick={() => sendAlert(btn.type)} disabled={!!sending || !phone}
                className={`flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}>
                {sending === btn.type ? <Loader2 className="h-5 w-5 animate-spin" /> : <btn.icon className="h-5 w-5" />}
                <div>
                  <p className="font-semibold text-sm">{btn.label}</p>
                  <p className="text-xs opacity-70">{btn.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {!phone && <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Add a phone number above to enable alerts</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Alert history</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
          : logs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No alerts sent yet</p>
          : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    {log.status === "sent"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    <div>
                      <p className="font-medium capitalize">{log.type.replace("_", " ")} alert</p>
                      <p className="text-xs text-muted-foreground">To: {log.recipient}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{log.status}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
