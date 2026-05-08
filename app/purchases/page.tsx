"use client";
import { useState, useEffect } from "react";
import { Plus, Truck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/utils";
import { toast } from "@/hooks/use-toast";

type Supplier = { id: string; name: string; };
type Medicine = { id: string; name: string; purchase_price: number; stock_qty: number; unit: string; };
type PurchaseItem = { medicine_id: string; medicine_name: string; qty: number; unit_price: number; batch_no: string; expiry_date: string; };
type Purchase = { id: string; total: number; paid: number; due: number; purchase_date: string; suppliers: { name: string } | null; purchase_items: { count: number }[]; };

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();
    if (!pharmacy) { setLoading(false); return; }
    setPharmacyId(pharmacy.id);
    const [p, s, m] = await Promise.all([
      supabase.from("purchases").select("*, suppliers(name), purchase_items(count)").eq("pharmacy_id", pharmacy.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("suppliers").select("id, name").eq("pharmacy_id", pharmacy.id).order("name"),
      supabase.from("medicines").select("id, name, purchase_price, stock_qty, unit").eq("pharmacy_id", pharmacy.id).order("name"),
    ]);
    setPurchases((p.data ?? []) as any);
    setSuppliers(s.data ?? []);
    setMedicines(m.data ?? []);
    setLoading(false);
  }

  function addItem() {
    setItems(prev => [...prev, { medicine_id: "", medicine_name: "", qty: 1, unit_price: 0, batch_no: "", expiry_date: "" }]);
  }

  function updateItem(i: number, k: string, v: any) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (k === "medicine_id") {
        const med = medicines.find(m => m.id === v);
        return { ...item, medicine_id: v, medicine_name: med?.name ?? "", unit_price: med?.purchase_price ?? 0 };
      }
      return { ...item, [k]: v };
    }));
  }

  const total = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const due = Math.max(0, total - Number(paidAmount));

  async function save() {
    if (!supplierId || items.length === 0 || items.some(i => !i.medicine_id)) {
      toast({ variant: "destructive", title: "Incomplete", description: "Please fill all fields." }); return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: purchase, error } = await supabase.from("purchases").insert({
      pharmacy_id: pharmacyId, supplier_id: supplierId,
      total, paid: Number(paidAmount), due, purchase_date: purchaseDate,
    }).select().single();
    if (error || !purchase) { toast({ variant: "destructive", title: "Error", description: error?.message }); setSaving(false); return; }

    for (const item of items) {
      const med = medicines.find(m => m.id === item.medicine_id);
      const { data: batch } = await supabase.from("batches").insert({
        medicine_id: item.medicine_id, pharmacy_id: pharmacyId,
        batch_no: item.batch_no || `BATCH-${Date.now()}`,
        expiry_date: item.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        qty: Number(item.qty), purchase_price: Number(item.unit_price), mfg_date: purchaseDate,
      }).select().single();

      await supabase.from("purchase_items").insert({
        purchase_id: purchase.id, medicine_id: item.medicine_id,
        batch_id: batch?.id, qty: Number(item.qty), unit_price: Number(item.unit_price),
      });
      await supabase.from("medicines").update({ stock_qty: (med?.stock_qty ?? 0) + Number(item.qty) }).eq("id", item.medicine_id);
    }

    toast({ title: "Purchase recorded!", description: `Total: ${formatCurrency(total)}` });
    setOpen(false); setItems([]); setSupplierId(""); setPaidAmount(0); fetchData();
    setSaving(false);
  }

  const filtered = purchases.filter(p => p.suppliers?.name?.toLowerCase().includes(search.toLowerCase()) || formatDate(p.purchase_date).includes(search));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchases <span className="text-muted-foreground font-normal text-lg">/ ক্রয়</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5">{purchases.length} purchase records</p>
        </div>
        <Button onClick={() => { setItems([{ medicine_id: "", medicine_name: "", qty: 1, unit_price: 0, batch_no: "", expiry_date: "" }]); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />New purchase</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by supplier or date..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Truck className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No purchases recorded</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Record your first stock purchase</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Total</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Paid</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.suppliers?.name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{formatDate(p.purchase_date)}</td>
                  <td className="p-3 text-right hidden sm:table-cell">{formatCurrency(p.total)}</td>
                  <td className="p-3 text-right text-emerald-600 hidden sm:table-cell">{formatCurrency(p.paid)}</td>
                  <td className={`p-3 text-right font-semibold ${p.due > 0 ? "text-red-600" : "text-muted-foreground"}`}>{p.due > 0 ? formatCurrency(p.due) : "Paid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase / নতুন ক্রয়</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Purchase date</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items *</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add row</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                    <div className="col-span-4 space-y-1">
                      {idx === 0 && <Label className="text-xs">Medicine</Label>}
                      <Select value={item.medicine_id} onValueChange={v => updateItem(idx, "medicine_id", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{medicines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      {idx === 0 && <Label className="text-xs">Qty</Label>}
                      <Input className="h-8 text-xs" type="number" min={1} value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {idx === 0 && <Label className="text-xs">Price (৳)</Label>}
                      <Input className="h-8 text-xs" type="number" min={0} value={item.unit_price} onChange={e => updateItem(idx, "unit_price", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {idx === 0 && <Label className="text-xs">Batch No.</Label>}
                      <Input className="h-8 text-xs" placeholder="B001" value={item.batch_no} onChange={e => updateItem(idx, "batch_no", e.target.value)} />
                    </div>
                    <div className="col-span-1 space-y-1">
                      {idx === 0 && <Label className="text-xs">Expiry</Label>}
                      <Input className="h-8 text-xs" type="date" value={item.expiry_date} onChange={e => updateItem(idx, "expiry_date", e.target.value)} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <div className="space-y-1.5"><Label>Amount paid (৳)</Label><Input type="number" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} /></div>
              <div className="rounded-lg bg-muted p-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold">{formatCurrency(total)}</span></div>
                <div className={`flex justify-between text-sm mt-1 ${due > 0 ? "text-red-600" : "text-emerald-600"}`}><span>Due</span><span className="font-bold">{formatCurrency(due)}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Record purchase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
