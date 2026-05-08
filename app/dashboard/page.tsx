import { createClient } from "@/lib/supabase/server";
import { Package, ShoppingCart, AlertTriangle, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, getDaysUntilExpiry, getExpiryStatus } from "@/utils";
import Link from "next/link";
import { cn } from "@/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: pharmacy } = await supabase.from("pharmacies").select("*").eq("user_id", user!.id).single();

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [medicines, todaySales, expiringSoon, lowStock, recentSales] = await Promise.all([
    supabase.from("medicines").select("id, stock_qty, reorder_level", { count: "exact" }).eq("pharmacy_id", pharmacy?.id ?? ""),
    supabase.from("sales").select("total").eq("pharmacy_id", pharmacy?.id ?? "").gte("sale_date", today),
    supabase.from("batches").select("*, medicines(name)").eq("pharmacy_id", pharmacy?.id ?? "").lte("expiry_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).order("expiry_date", { ascending: true }).limit(5),
    supabase.from("medicines").select("id, name, stock_qty, reorder_level").eq("pharmacy_id", pharmacy?.id ?? ""),
    supabase.from("sales").select("*, sale_items(count)").eq("pharmacy_id", pharmacy?.id ?? "").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalMedicines = medicines.count ?? 0;
  const todayRevenue = todaySales.data?.reduce((s, sale) => s + (sale.total ?? 0), 0) ?? 0;
  const lowStockCount = (lowStock.data ?? []).filter(m => (m.stock_qty ?? 0) <= (m.reorder_level ?? 0)).length;
  const expiryCount = (expiringSoon.data ?? []).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "শুভ সকাল" : hour < 17 ? "শুভ অপরাহ্ন" : "শুভ সন্ধ্যা";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{greeting}! 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">{pharmacy?.name ?? "Your Pharmacy"} — {formatDate(new Date())}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total medicines", title_bn: "মোট ওষুধ", value: totalMedicines, icon: Package, color: "text-blue-600", bg: "bg-blue-50", href: "/medicines" },
          { title: "Today's revenue", title_bn: "আজকের আয়", value: formatCurrency(todayRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", href: "/sales" },
          { title: "Low stock items", title_bn: "কম স্টক", value: lowStockCount, icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-50", href: "/medicines" },
          { title: "Expiring soon", title_bn: "মেয়াদ শেষ হচ্ছে", value: expiryCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/expiry" },
        ].map(s => (
          <Link key={s.title} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground/70">{s.title_bn}</p>
                    <p className={`mt-2 text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${s.bg}`}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Expiring soon</CardTitle>
            <Link href="/expiry"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all <ArrowRight className="h-3 w-3"/></Button></Link>
          </CardHeader>
          <CardContent>
            {(expiringSoon.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No medicines expiring in 90 days</p>
            ) : (
              <div className="space-y-2">
                {(expiringSoon.data ?? []).map((batch: any) => {
                  const status = getExpiryStatus(batch.expiry_date);
                  const days = getDaysUntilExpiry(batch.expiry_date);
                  return (
                    <div key={batch.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{batch.medicines?.name}</p>
                        <p className="text-xs text-muted-foreground">Batch: {batch.batch_no} · Qty: {batch.qty}</p>
                      </div>
                      <span className={cn("text-xs px-2 py-1 rounded-full font-medium border",
                        status === "expired" ? "bg-red-100 text-red-700 border-red-200" :
                        status === "critical" ? "bg-orange-100 text-orange-700 border-orange-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      )}>
                        {days < 0 ? "Expired" : `${days}d left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Recent sales</CardTitle>
            <Link href="/sales"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all <ArrowRight className="h-3 w-3"/></Button></Link>
          </CardHeader>
          <CardContent>
            {(recentSales.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales yet today</p>
            ) : (
              <div className="space-y-2">
                {(recentSales.data ?? []).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{sale.customer_name ?? "Walk-in customer"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.sale_date)}</p>
                    </div>
                    <p className="font-semibold text-emerald-600">{formatCurrency(sale.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
