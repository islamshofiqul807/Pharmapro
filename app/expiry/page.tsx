"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getDaysUntilExpiry, getExpiryStatus, cn } from "@/utils";

type Batch = { id: string; batch_no: string; expiry_date: string; qty: number; medicines: { name: string; category: string } | null; };

export default function ExpiryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();
      if (!pharmacy) { setLoading(false); return; }
      const cutoff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("batches")
        .select("id, batch_no, expiry_date, qty, medicines(name, category)")
        .eq("pharmacy_id", pharmacy.id)
        .lte("expiry_date", cutoff)
        .gt("qty", 0)
        .order("expiry_date", { ascending: true });
      setBatches((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const expired = batches.filter(b => getExpiryStatus(b.expiry_date) === "expired");
  const critical = batches.filter(b => getExpiryStatus(b.expiry_date) === "critical");
  const warning = batches.filter(b => getExpiryStatus(b.expiry_date) === "warning");

  const statusConfig = {
    expired: { label: "Expired", label_bn: "মেয়াদ শেষ", icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", items: expired },
    critical: { label: "Critical (≤30 days)", label_bn: "গুরুতর (≤৩০ দিন)", icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", items: critical },
    warning: { label: "Warning (31–90 days)", label_bn: "সতর্কতা (৩১–৯০ দিন)", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", items: warning },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Expiry Tracker <span className="text-muted-foreground font-normal text-lg">/ মেয়াদ ট্র্যাকার</span></h1>
        <p className="text-sm text-muted-foreground mt-0.5">Medicines expiring within 90 days</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Expired", value: expired.length, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
          { label: "Critical (≤30d)", value: critical.length, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Warning (≤90d)", value: warning.length, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`rounded-lg p-2.5 ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="font-medium">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">No medicines expiring in the next 90 days.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(statusConfig).map(([key, cfg]) => cfg.items.length > 0 && (
            <div key={key}>
              <div className={`flex items-center gap-2 mb-3 p-3 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-muted-foreground">/ {cfg.label_bn}</span>
                <Badge variant="outline" className="ml-auto text-xs">{cfg.items.length} items</Badge>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground">Medicine</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Batch No.</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Expiry Date</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Days Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cfg.items.map(b => {
                      const days = getDaysUntilExpiry(b.expiry_date);
                      return (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">{b.medicines?.name ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{b.batch_no}</td>
                          <td className="p-3">{formatDate(b.expiry_date)}</td>
                          <td className="p-3 text-right">{b.qty}</td>
                          <td className="p-3 text-right">
                            <span className={cn("font-semibold", key === "expired" ? "text-red-600" : key === "critical" ? "text-orange-600" : "text-amber-600")}>
                              {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
