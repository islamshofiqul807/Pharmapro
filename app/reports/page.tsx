import { createClient } from "@/lib/supabase/server";
import { BarChart3, TrendingUp, Package, ShoppingCart, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/utils";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];

  const [monthlySales, yearSales, monthPurchases, topMeds, totalStock] = await Promise.all([
    supabase.from("sales").select("total").eq("pharmacy_id", pharmacy?.id ?? "").gte("sale_date", monthStart),
    supabase.from("sales").select("total").eq("pharmacy_id", pharmacy?.id ?? "").gte("sale_date", yearStart),
    supabase.from("purchases").select("total").eq("pharmacy_id", pharmacy?.id ?? "").gte("purchase_date", monthStart),
    supabase.from("sale_items").select("qty, medicines(name)").eq("pharmacy_id", pharmacy?.id ?? "").limit(100),
    supabase.from("medicines").select("stock_qty, purchase_price").eq("pharmacy_id", pharmacy?.id ?? ""),
  ]);

  const monthRevenue = (monthlySales.data ?? []).reduce((s, r) => s + r.total, 0);
  const yearRevenue = (yearSales.data ?? []).reduce((s, r) => s + r.total, 0);
  const monthPurchaseTotal = (monthPurchases.data ?? []).reduce((s, r) => s + r.total, 0);
  const monthProfit = monthRevenue - monthPurchaseTotal;
  const stockValue = (totalStock.data ?? []).reduce((s, m) => s + m.stock_qty * m.purchase_price, 0);

  const medSales: Record<string, number> = {};
  (topMeds.data ?? []).forEach((item: any) => {
    const name = item.medicines?.name ?? "Unknown";
    medSales[name] = (medSales[name] ?? 0) + item.qty;
  });
  const topMedicines = Object.entries(medSales).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const monthName = now.toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Reports <span className="text-muted-foreground font-normal text-lg">/ রিপোর্ট</span></h1>
        <p className="text-sm text-muted-foreground mt-0.5">Business overview and analytics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: `${monthName} Revenue`, label_bn: "এই মাসের আয়", value: formatCurrency(monthRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: `${monthName} Profit`, label_bn: "এই মাসের লাভ", value: formatCurrency(monthProfit), icon: BarChart3, color: monthProfit >= 0 ? "text-blue-600" : "text-red-600", bg: "bg-blue-50" },
          { label: "Year Revenue", label_bn: "বার্ষিক আয়", value: formatCurrency(yearRevenue), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Stock Value", label_bn: "স্টক মূল্য", value: formatCurrency(stockValue), icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground/70">{s.label_bn}</p>
                  <p className={`mt-2 text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-500" />Top selling medicines</CardTitle>
          </CardHeader>
          <CardContent>
            {topMedicines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                {topMedicines.map(([name, qty], i) => {
                  const max = topMedicines[0][1];
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium flex items-center gap-2"><span className="w-5 text-muted-foreground text-xs text-right">{i + 1}.</span>{name}</span>
                        <span className="text-muted-foreground font-medium">{qty} sold</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(qty / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-blue-500" />This month summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Total sales revenue", value: formatCurrency(monthRevenue), color: "text-emerald-600" },
                { label: "Total purchase cost", value: formatCurrency(monthPurchaseTotal), color: "text-red-500" },
                { label: "Gross profit", value: formatCurrency(monthProfit), color: monthProfit >= 0 ? "text-blue-600" : "text-red-600", bold: true },
                { label: "Profit margin", value: monthRevenue > 0 ? `${((monthProfit / monthRevenue) * 100).toFixed(1)}%` : "—", color: "text-purple-600" },
              ].map(row => (
                <div key={row.label} className={`flex justify-between text-sm ${row.bold ? "font-bold border-t pt-3" : ""}`}>
                  <span className={row.bold ? "" : "text-muted-foreground"}>{row.label}</span>
                  <span className={row.color}>{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
