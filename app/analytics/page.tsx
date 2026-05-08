"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/utils";
import { MEDICINE_CATEGORIES } from "@/lib/constants";

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

type RangeKey = "7d" | "30d" | "90d" | "1y";

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [pharmacyId, setPharmacyId] = useState("");
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [topMedicines, setTopMedicines] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ revenue: 0, prevRevenue: 0, orders: 0, prevOrders: 0, avgOrder: 0, prevAvgOrder: 0, profit: 0, prevProfit: 0 });
  const [hourlyPattern, setHourlyPattern] = useState<any[]>([]);
  const [stockStatus, setStockStatus] = useState<any[]>([]);

  const rangeDays: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

  useEffect(() => { init(); }, []);
  useEffect(() => { if (pharmacyId) fetchData(); }, [pharmacyId, range]);

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();
    if (pharmacy) setPharmacyId(pharmacy.id);
  }

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const days = rangeDays[range];
    const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const prevFrom = new Date(Date.now() - days * 2 * 86400000).toISOString().split("T")[0];

    const [sales, prevSales, saleItems, purchases, medicines] = await Promise.all([
      supabase.from("sales").select("id, total, discount, sale_date, created_at").eq("pharmacy_id", pharmacyId).gte("sale_date", from).order("sale_date"),
      supabase.from("sales").select("total").eq("pharmacy_id", pharmacyId).gte("sale_date", prevFrom).lt("sale_date", from),
      supabase.from("sale_items").select("qty, sale_price, medicines(name, category)").eq("pharmacy_id", pharmacyId).gte("created_at", new Date(Date.now() - days * 86400000).toISOString()),
      supabase.from("purchases").select("total").eq("pharmacy_id", pharmacyId).gte("purchase_date", from),
      supabase.from("medicines").select("stock_qty, reorder_level, category").eq("pharmacy_id", pharmacyId),
    ]);

    // KPIs
    const rev = (sales.data ?? []).reduce((s, x) => s + x.total, 0);
    const prevRev = (prevSales.data ?? []).reduce((s, x) => s + x.total, 0);
    const orders = sales.data?.length ?? 0;
    const prevOrders = prevSales.data?.length ?? 0;
    const purchaseTotal = (purchases.data ?? []).reduce((s, x) => s + x.total, 0);
    setKpis({ revenue: rev, prevRevenue: prevRev, orders, prevOrders, avgOrder: orders ? rev / orders : 0, prevAvgOrder: prevOrders ? prevRev / prevOrders : 0, profit: rev - purchaseTotal, prevProfit: prevRev });

    // Sales trend — group by date
    const byDate: Record<string, { revenue: number; orders: number; profit: number }> = {};
    (sales.data ?? []).forEach(s => {
      byDate[s.sale_date] = byDate[s.sale_date] ?? { revenue: 0, orders: 0, profit: 0 };
      byDate[s.sale_date].revenue += s.total;
      byDate[s.sale_date].orders += 1;
    });
    // Fill missing dates
    const trend = [];
    for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      const label = new Date(d).toLocaleDateString("en-BD", { month: "short", day: "numeric" });
      trend.push({ date: label, revenue: byDate[d]?.revenue ?? 0, orders: byDate[d]?.orders ?? 0 });
    }
    setSalesTrend(trend);

    // Top medicines by revenue
    const medMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    (saleItems.data ?? []).forEach((item: any) => {
      const name = item.medicines?.name ?? "Unknown";
      medMap[name] = medMap[name] ?? { name, qty: 0, revenue: 0 };
      medMap[name].qty += item.qty;
      medMap[name].revenue += item.qty * item.sale_price;
    });
    setTopMedicines(Object.values(medMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8));

    // Category breakdown by revenue
    const catMap: Record<string, number> = {};
    (saleItems.data ?? []).forEach((item: any) => {
      const cat = item.medicines?.category ?? "other";
      catMap[cat] = (catMap[cat] ?? 0) + item.qty * item.sale_price;
    });
    const catData = Object.entries(catMap).map(([key, val]) => ({
      name: MEDICINE_CATEGORIES.find(c => c.value === key)?.label ?? key,
      value: Math.round(val),
    })).sort((a, b) => b.value - a.value);
    setCategoryBreakdown(catData);

    // Stock status
    const meds = medicines.data ?? [];
    const ok = meds.filter(m => m.stock_qty > m.reorder_level).length;
    const low = meds.filter(m => m.stock_qty > 0 && m.stock_qty <= m.reorder_level).length;
    const out = meds.filter(m => m.stock_qty <= 0).length;
    setStockStatus([{ name: "In Stock", value: ok }, { name: "Low Stock", value: low }, { name: "Out of Stock", value: out }]);

    setLoading(false);
  }

  function pct(cur: number, prev: number) {
    if (!prev) return 0;
    return ((cur - prev) / prev * 100);
  }

  const KPICard = ({ title, title_bn, value, prev, format = (v: number) => formatCurrency(v), icon: Icon, color }: any) => {
    const change = pct(value, prev);
    const up = change >= 0;
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{title}</p>
              <p className="text-[10px] text-muted-foreground/60">{title_bn}</p>
            </div>
            <div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
          </div>
          <p className="text-2xl font-bold">{loading ? "—" : format(value)}</p>
          {prev !== undefined && !loading && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}% vs previous period
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" }, { key: "1y", label: "1 year" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics <span className="text-muted-foreground font-normal text-lg">/ বিশ্লেষণ</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business performance insights</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {ranges.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${range === r.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Revenue" title_bn="রাজস্ব" value={kpis.revenue} prev={kpis.prevRevenue} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
        <KPICard title="Gross Profit" title_bn="মোট লাভ" value={kpis.profit} prev={kpis.prevProfit} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
        <KPICard title="Total Orders" title_bn="মোট অর্ডার" value={kpis.orders} prev={kpis.prevOrders} icon={ShoppingCart} color="bg-purple-50 text-purple-600" format={(v: number) => v.toString()} />
        <KPICard title="Avg Order Value" title_bn="গড় অর্ডার মূল্য" value={kpis.avgOrder} prev={kpis.prevAvgOrder} icon={Package} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Sales Trend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend / রাজস্ব প্রবণতা</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="h-64 bg-muted animate-pulse rounded" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Sales by Category / ক্যাটাগরি অনুযায়ী বিক্রয়</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="h-64 bg-muted animate-pulse rounded" /> : categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No sales data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="name" paddingAngle={3}>
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stock Status */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Stock Status / স্টক অবস্থা</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="h-64 bg-muted animate-pulse rounded" /> : (
              <div className="space-y-4 pt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stockStatus} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                      {["#10b981","#f59e0b","#ef4444"].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {stockStatus.map((s, i) => (
                    <div key={s.name} className="rounded-lg bg-muted p-2">
                      <p className="font-bold text-lg">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Medicines Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Top Medicines by Revenue / শীর্ষ ওষুধ</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="h-48 bg-muted animate-pulse rounded" /> : topMedicines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topMedicines.map((med, i) => {
                const maxRev = topMedicines[0].revenue;
                return (
                  <div key={med.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground text-right font-medium">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{med.name}</span>
                        <span className="text-muted-foreground ml-2 flex-shrink-0">{med.qty} units · {formatCurrency(med.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(med.revenue / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily orders bar chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Daily Order Volume / দৈনিক অর্ডার</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="h-48 bg-muted animate-pulse rounded" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
