"use client";
import { useState, useEffect } from "react";
import { Plus, Users, Phone, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/utils";
import { toast } from "@/hooks/use-toast";

type Supplier = { id: string; name: string; phone: string; address: string; balance: number; };
const empty = { name: "", phone: "", address: "", balance: 0 };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);
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
    const { data } = await supabase.from("suppliers").select("*").eq("pharmacy_id", pharmacy.id).order("name");
    setSuppliers(data ?? []);
    setLoading(false);
  }

  function openAdd() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(s: Supplier) { setEditing(s); setForm({ name: s.name, phone: s.phone, address: s.address, balance: s.balance }); setOpen(true); }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, pharmacy_id: pharmacyId, balance: Number(form.balance) };
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else { toast({ title: editing ? "Supplier updated" : "Supplier added" }); setOpen(false); fetchData(); }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this supplier?")) return;
    const supabase = createClient();
    await supabase.from("suppliers").delete().eq("id", id);
    toast({ title: "Supplier deleted" });
    fetchData();
  }

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search));
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers <span className="text-muted-foreground font-normal text-lg">/ সরবরাহকারী</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5">{suppliers.length} suppliers</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />Add supplier</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No suppliers yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add your medicine suppliers to track purchases</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    {s.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{s.phone}</p>}
                    {s.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.address}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding balance</p>
                    <p className={`font-bold ${s.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(Math.abs(s.balance))}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEdit(s)}><Edit className="h-3 w-3 mr-1" />Edit</Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => del(s.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Supplier name *</Label><Input placeholder="ABC Pharmaceuticals" value={form.name} onChange={e => f("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => f("phone", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input placeholder="Dhaka, Bangladesh" value={form.address} onChange={e => f("address", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Opening balance (৳)</Label><Input type="number" value={form.balance} onChange={e => f("balance", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving..." : editing ? "Update" : "Add supplier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
