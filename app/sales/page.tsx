"use client";
import { useState, useEffect } from "react";
import { Plus, ShoppingCart, Search, Receipt, X, Scan, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/utils";
import { toast } from "@/hooks/use-toast";
import { ReceiptPrinter } from "@/components/features/receipt-printer";
import { BarcodeScanner } from "@/components/features/barcode-scanner";

type Medicine = { id: string; name: string; sale_price: number; stock_qty: number; unit: string; };
type CartItem = Medicine & { qty: number; };
type Sale = { id: string; total: number; discount: number; paid: number; customer_name: string; sale_date: string; sale_items: any[]; };
type Customer = { id: string; name: string; phone: string; total_due: number; total_paid: number; credit_limit: number; };
type Pharmacy = { name: string; address?: string; phone?: string; license_no?: string; };

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pharmacy, setPharmacy] = useState<Pharmacy>({ name: "My Pharmacy" });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("cash");
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: ph } = await supabase.from("pharmacies").select("*").eq("user_id", user!.id).single();
    if (!ph) { setLoading(false); return; }
    setPharmacyId(ph.id);
    setPharmacy({ name: ph.name, address: ph.address, phone: ph.phone, license_no: ph.license_no });
    const [s, m, c] = await Promise.all([
      supabase.from("sales").select("*, sale_items(count)").eq("pharmacy_id", ph.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("medicines").select("id, name, sale_price, stock_qty, unit").eq("pharmacy_id", ph.id).gt("stock_qty", 0).order("name"),
      supabase.from("customers").select("*").eq("pharmacy_id", ph.id).order("name"),
    ]);
    setSales((s.data ?? []) as any);
    setMedicines(m.data ?? []);
    setCustomers(c.data ?? []);
    setLoading(false);
  }

  function addToCart(m: Medicine) {
    setCart(prev => {
      const ex = prev.find(i => i.id === m.id);
      if (ex) return prev.map(i => i.id === m.id ? { ...i, qty: Math.min(i.qty + 1, m.stock_qty) } : i);
      return [...prev, { ...m, qty: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(p => p.filter(i => i.id !== id)); return; }
    setCart(p => p.map(i => i.id === id ? { ...i, qty: Math.min(qty, i.stock_qty) } : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.sale_price * i.qty, 0);
  const total = Math.max(0, subtotal - Number(discount));

  async function completeSale() {
    if (cart.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    const selectedCustomer = customers.find(c => c.id === customerId);
    const finalCustomerName = (selectedCustomer?.name ?? customerName) || "Walk-in customer";

    const { data: sale, error } = await supabase.from("sales").insert({
      pharmacy_id: pharmacyId,
      customer_id: customerId || null,
      customer_name: finalCustomerName,
      total, discount: Number(discount),
      paid: paymentMode === "cash" ? total : 0,
      sale_date: new Date().toISOString().split("T")[0],
    }).select().single();

    if (error || !sale) { toast({ variant: "destructive", title: "Error", description: error?.message }); setSaving(false); return; }

    const items = cart.map(i => ({ sale_id: sale.id, pharmacy_id: pharmacyId, medicine_id: i.id, qty: i.qty, unit_price: i.sale_price, sale_price: i.sale_price }));
    await supabase.from("sale_items").insert(items);

    for (const item of cart) {
      await supabase.from("medicines").update({ stock_qty: item.stock_qty - item.qty }).eq("id", item.id);
    }

    // Update customer dues if credit sale
    if (paymentMode === "credit" && customerId) {
      const cust = customers.find(c => c.id === customerId);
      if (cust) await supabase.from("customers").update({ total_due: cust.total_due + total }).eq("id", customerId);
    }

    toast({ title: "Sale complete!", description: `${formatCurrency(total)} — ${paymentMode === "credit" ? "added to customer dues" : "cash"}` });

    // Show receipt
    setReceiptSale({
      id: sale.id, customer_name: finalCustomerName,
      sale_date: sale.sale_date, total, discount: Number(discount), paid: paymentMode === "cash" ? total : 0,
      items: cart.map(i => ({ name: i.name, qty: i.qty, unit_price: i.sale_price, sale_price: i.sale_price })),
    });
    setCart([]); setCustomerName(""); setCustomerId(""); setDiscount(0); setPaymentMode("cash");
    setOpen(false); setReceiptOpen(true);
    fetchData(); setSaving(false);
  }

  const filteredMeds = medicines.filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase()));
  const filteredSales = sales.filter(s => s.customer_name?.toLowerCase().includes(search.toLowerCase()) || formatDate(s.sale_date).includes(search));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales <span className="text-muted-foreground font-normal text-lg">/ বিক্রয়</span></h1>
          <p className="text-sm text-muted-foreground">{sales.length} recent transactions</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" />New sale</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by customer or date..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No sales yet</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Items</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{sale.customer_name ?? "Walk-in"}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{formatDate(sale.sale_date)}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{sale.sale_items?.[0]?.count ?? 0}</td>
                  <td className="p-3 text-right font-semibold text-emerald-600">{formatCurrency(sale.total)}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={async () => {
                      const supabase = createClient();
                      const { data: items } = await supabase.from("sale_items").select("qty, sale_price, medicines(name)").eq("sale_id", sale.id);
                      setReceiptSale({
                        id: sale.id, customer_name: sale.customer_name, sale_date: sale.sale_date,
                        total: sale.total, discount: sale.discount, paid: sale.paid,
                        items: (items ?? []).map((i: any) => ({ name: i.medicines?.name, qty: i.qty, unit_price: i.sale_price, sale_price: i.sale_price })),
                      });
                      setReceiptOpen(true);
                    }}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* POS Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Receipt className="h-5 w-5" />New Sale</span>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setScannerOpen(true)}>
                <Scan className="h-3.5 w-3.5" />Scan
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-sm mb-2">Search medicines</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-9 text-sm" placeholder="Type medicine name..." value={medSearch} onChange={e => setMedSearch(e.target.value)} />
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-1">
                {filteredMeds.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No medicines found</p>
                  : filteredMeds.map(m => (
                    <button key={m.id} onClick={() => addToCart(m)} className="w-full flex items-center justify-between rounded p-2 text-sm hover:bg-accent text-left">
                      <div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">Stock: {m.stock_qty} {m.unit}</p></div>
                      <p className="font-semibold text-emerald-600">{formatCurrency(m.sale_price)}</p>
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-sm mb-2">Cart ({cart.length})</p>
              <div className="space-y-2 min-h-24 max-h-52 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">Cart is empty</p>
                ) : cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.sale_price)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="h-6 w-6 rounded border text-xs font-bold hover:bg-accent">-</button>
                      <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="h-6 w-6 rounded border text-xs font-bold hover:bg-accent">+</button>
                    </div>
                    <p className="text-sm font-semibold w-16 text-right">{formatCurrency(item.sale_price * item.qty)}</p>
                    <button onClick={() => setCart(p => p.filter(i => i.id !== item.id))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2 border-t pt-3">
                {customers.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Customer (optional)</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Walk-in customer</SelectItem>
                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!customerId && (
                  <div className="space-y-1"><Label className="text-xs">Customer name</Label><Input className="h-8 text-xs" placeholder="Walk-in customer" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                )}
                <div className="space-y-1"><Label className="text-xs">Discount (৳)</Label><Input type="number" className="h-8 text-xs" value={discount || ""} onChange={e => setDiscount(Number(e.target.value))} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment</Label>
                  <div className="flex gap-2">
                    {["cash", "credit"].map(mode => (
                      <button key={mode} onClick={() => setPaymentMode(mode as any)} disabled={mode === "credit" && !customerId}
                        className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-all capitalize ${paymentMode === mode ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted disabled:opacity-40"}`}>
                        {mode === "cash" ? "💵 Cash" : "💳 Credit"}
                      </button>
                    ))}
                  </div>
                  {paymentMode === "credit" && !customerId && <p className="text-[10px] text-amber-600">Select a customer to use credit</p>}
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span><span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setCart([]); }}>Cancel</Button>
            <Button onClick={completeSale} disabled={saving || cart.length === 0} className="gap-2">
              <Receipt className="h-4 w-4" />{saving ? "Processing..." : "Complete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onFound={m => { addToCart(m); setScannerOpen(false); }} pharmacyId={pharmacyId} />

      {/* Receipt */}
      {receiptSale && pharmacy && (
        <ReceiptPrinter open={receiptOpen} onClose={() => setReceiptOpen(false)} sale={receiptSale} pharmacy={pharmacy} />
      )}
    </div>
  );
}
