"use client";
import { useState, useEffect } from "react";
import { Plus, Search, Package, Edit, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { MEDICINE_CATEGORIES, MEDICINE_UNITS } from "@/lib/constants";
import { formatCurrency, cn } from "@/utils";
import { toast } from "@/hooks/use-toast";

type Medicine = {
  id: string; name: string; generic_name: string; brand: string;
  category: string; unit: string; purchase_price: number; sale_price: number;
  stock_qty: number; reorder_level: number; rack_location: string;
};

const empty: Omit<Medicine, "id"> = {
  name: "", generic_name: "", brand: "", category: "tablet", unit: "strip",
  purchase_price: 0, sale_price: 0, stock_qty: 0, reorder_level: 10, rack_location: "",
};

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string>("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pharmacy } = await supabase.from("pharmacies").select("id").eq("user_id", user!.id).single();
    if (!pharmacy) { setLoading(false); return; }
    setPharmacyId(pharmacy.id);
    const { data } = await supabase.from("medicines").select("*").eq("pharmacy_id", pharmacy.id).order("name");
    setMedicines(data ?? []);
    setLoading(false);
  }

  function openAdd() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(m: Medicine) { setEditing(m); setForm({ name: m.name, generic_name: m.generic_name, brand: m.brand, category: m.category, unit: m.unit, purchase_price: m.purchase_price, sale_price: m.sale_price, stock_qty: m.stock_qty, reorder_level: m.reorder_level, rack_location: m.rack_location }); setOpen(true); }

  async function save() {
    if (!form.name || !pharmacyId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, pharmacy_id: pharmacyId, purchase_price: Number(form.purchase_price), sale_price: Number(form.sale_price), stock_qty: Number(form.stock_qty), reorder_level: Number(form.reorder_level) };
    const { error } = editing
      ? await supabase.from("medicines").update(payload).eq("id", editing.id)
      : await supabase.from("medicines").insert(payload);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); }
    else { toast({ title: editing ? "Medicine updated" : "Medicine added" }); setOpen(false); fetchData(); }
    setSaving(false);
  }

  async function deleteMedicine(id: string) {
    if (!confirm("Delete this medicine?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("medicines").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Cannot delete", description: error.message });
    else { toast({ title: "Medicine deleted" }); fetchData(); }
  }

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Medicines <span className="text-muted-foreground font-normal text-lg">/ ওষুধ</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5">{medicines.length} medicines in inventory</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />Add medicine</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, generic, or brand..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">{search ? "No medicines found" : "No medicines yet"}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{search ? "Try a different search" : "Click 'Add medicine' to get started"}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const isLow = m.stock_qty <= m.reorder_level;
            const cat = MEDICINE_CATEGORIES.find(c => c.value === m.category);
            return (
              <Card key={m.id} className={cn("hover:shadow-md transition-shadow", isLow && "border-amber-300")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.generic_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.brand}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] ml-2 flex-shrink-0">{cat?.label ?? m.category}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <div><span className="text-muted-foreground text-xs">Sale price</span><p className="font-semibold text-emerald-600">{formatCurrency(m.sale_price)}</p></div>
                    <div><span className="text-muted-foreground text-xs">Purchase</span><p className="font-medium">{formatCurrency(m.purchase_price)}</p></div>
                    <div className="col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground text-xs">Stock</span>
                        <p className={cn("font-bold", isLow ? "text-amber-600" : "text-foreground")}>{m.stock_qty} {m.unit}</p>
                      </div>
                      {isLow && <div className="flex items-center gap-1 text-amber-600 text-xs"><AlertCircle className="h-3 w-3" />Low stock</div>}
                    </div>
                    {m.rack_location && <div className="col-span-2 text-xs text-muted-foreground">Rack: {m.rack_location}</div>}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEdit(m)}><Edit className="h-3 w-3 mr-1" />Edit</Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => deleteMedicine(m.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit medicine" : "Add new medicine"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Medicine name *</Label><Input placeholder="Napa 500mg" value={form.name} onChange={e => f("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Generic name</Label><Input placeholder="Paracetamol" value={form.generic_name} onChange={e => f("generic_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Brand</Label><Input placeholder="Beximco" value={form.brand} onChange={e => f("brand", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={form.category} onValueChange={v => f("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEDICINE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={form.unit} onValueChange={v => f("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEDICINE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Purchase price (৳)</Label><Input type="number" min={0} value={form.purchase_price} onChange={e => f("purchase_price", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Sale price (৳)</Label><Input type="number" min={0} value={form.sale_price} onChange={e => f("sale_price", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Opening stock</Label><Input type="number" min={0} value={form.stock_qty} onChange={e => f("stock_qty", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Reorder level</Label><Input type="number" min={0} value={form.reorder_level} onChange={e => f("reorder_level", e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Rack location</Label><Input placeholder="A-12" value={form.rack_location} onChange={e => f("rack_location", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving..." : editing ? "Update" : "Add medicine"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
