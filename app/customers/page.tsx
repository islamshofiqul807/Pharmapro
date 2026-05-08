"use client";
import { useState, useEffect } from "react";
import { Plus, Users, Phone, CreditCard, TrendingDown, Search, Edit, Eye, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/utils";
import { toast } from "@/hooks/use-toast";

type Customer = { id: string; name: string; phone: string; address: string; credit_limit: number; total_due: number; total_paid: number; created_at: string; };
type Payment = { id: string; amount: number; note: string; created_at: string; };
const empty = { name: "", phone: "", address: "", credit_limit: 5000 };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [payAmount, setPayAmount] = useState(0);
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();
    if (!pharmacy) { setLoading(false); return; }
    setPharmacyId(pharmacy.id);
    const { data } = await supabase.from("customers").select("*").eq("pharmacy_id", pharmacy.id).order("name");
    setCustomers(data ?? []);
    setLoading(false);
  }

  async function openDetail(c: Customer) {
    setSelected(c);
    setDetailOpen(true);
    const supabase = createClient();
    const [pays, sales] = await Promise.all([
      supabase.from("customer_payments").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("sales").select("id, total, discount, sale_date, sale_items(count)").eq("customer_id", c.id).order("sale_date", { ascending: false }).limit(20),
    ]);
    setPayments(pays.data ?? []);
    setSalesHistory(sales.data ?? []);
  }

  async function recordPayment() {
    if (!selected || payAmount <= 0) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("customer_payments").insert({ customer_id: selected.id, pharmacy_id: pharmacyId, amount: payAmount, note: payNote });
    await supabase.from("customers").update({ total_paid: selected.total_paid + payAmount }).eq("id", selected.id);
    toast({ title: "Payment recorded", description: `${formatCurrency(payAmount)} received from ${selected.name}` });
    setPayOpen(false); setPayAmount(0); setPayNote(""); fetchData();
    setSaving(false);
  }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, pharmacy_id: pharmacyId, credit_limit: Number(form.credit_limit), total_due: 0, total_paid: 0 };
    const { error } = editing
      ? await supabase.from("customers").update(form).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else { toast({ title: editing ? "Customer updated" : "Customer added" }); setOpen(false); fetchData(); }
    setSaving(false);
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );
  const totalDueAll = customers.reduce((s, c) => s + Math.max(0, c.total_due - c.total_paid), 0);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers <span className="text-muted-foreground font-normal text-lg">/ গ্রাহক</span></h1>
          <p className="text-sm text-muted-foreground">{customers.length} customers · Total due: <span className="text-red-600 font-semibold">{formatCurrency(totalDueAll)}</span></p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Add customer</Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total customers", value: customers.length.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total outstanding", value: formatCurrency(totalDueAll), icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
          { label: "Customers with dues", value: customers.filter(c => c.total_due > c.total_paid).length.toString(), icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`rounded-lg p-2.5 ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No customers yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add customers to track credit and dues</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Credit Limit</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Total Billed</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Paid</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Due</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(c => {
                const due = Math.max(0, c.total_due - c.total_paid);
                const overLimit = due > c.credit_limit;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</p>}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">{formatCurrency(c.credit_limit)}</td>
                    <td className="p-3 text-right hidden sm:table-cell">{formatCurrency(c.total_due)}</td>
                    <td className="p-3 text-right text-emerald-600 hidden sm:table-cell">{formatCurrency(c.total_paid)}</td>
                    <td className="p-3 text-right">
                      <span className={`font-bold ${due > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(due)}</span>
                      {overLimit && <p className="text-[10px] text-red-500">Over limit!</p>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDetail(c)}><Eye className="h-3 w-3 mr-1" />View</Button>
                        {due > 0 && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelected(c); setPayOpen(true); }}><CheckCircle2 className="h-3 w-3" />Pay</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Customer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Customer name *</Label><Input placeholder="Mohammad Karim" value={form.name} onChange={e => f("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => f("phone", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input placeholder="Dhaka, Bangladesh" value={form.address} onChange={e => f("address", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Credit limit (৳)</Label><Input type="number" value={form.credit_limit} onChange={e => f("credit_limit", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving..." : editing ? "Update" : "Add customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium">{selected?.name}</p>
              <p className="text-muted-foreground">Outstanding: <span className="font-bold text-red-600">{formatCurrency(Math.max(0, (selected?.total_due ?? 0) - (selected?.total_paid ?? 0)))}</span></p>
            </div>
            <div className="space-y-1.5"><Label>Amount received (৳) *</Label><Input type="number" min={1} value={payAmount || ""} onChange={e => setPayAmount(Number(e.target.value))} placeholder="0" /></div>
            <div className="space-y-1.5"><Label>Note (optional)</Label><Input placeholder="Cash payment, cheque #..." value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={saving || payAmount <= 0}>{saving ? "Saving..." : "Record payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" />{selected?.name} — Transaction History</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="font-semibold text-sm mb-3">Recent Sales</p>
              {salesHistory.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet</p> : (
                <div className="space-y-2">
                  {salesHistory.map((s: any) => (
                    <div key={s.id} className="flex justify-between text-sm border-b pb-2">
                      <div><p>{formatDate(s.sale_date)}</p><p className="text-xs text-muted-foreground">{s.sale_items?.[0]?.count ?? 0} items</p></div>
                      <p className="font-semibold text-emerald-600">{formatCurrency(s.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Payment History</p>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet</p> : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                      <div><p>{formatDate(p.created_at)}</p>{p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}</div>
                      <p className="font-semibold text-blue-600">{formatCurrency(p.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
