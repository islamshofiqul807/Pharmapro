import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSMS, buildLowStockMessage, buildExpiryMessage } from "@/lib/sms";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type } = body; // "low_stock" | "expiry" | "test"

  const { data: pharmacy } = await supabase.from("pharmacies").select("*").eq("user_id", user.id).single();
  if (!pharmacy?.phone) return NextResponse.json({ error: "No phone number configured" }, { status: 400 });

  let result;

  if (type === "test") {
    result = await sendSMS(pharmacy.phone, `[PharmaPro] Test message from ${pharmacy.name}. Your SMS alerts are working!`);
    return NextResponse.json(result);
  }

  if (type === "low_stock") {
    const { data: meds } = await supabase.from("medicines").select("name, stock_qty, reorder_level").eq("pharmacy_id", pharmacy.id);
    const low = (meds ?? []).filter(m => m.stock_qty <= m.reorder_level).map(m => ({ name: m.name, stock: m.stock_qty }));
    if (low.length === 0) return NextResponse.json({ success: false, message: "No low stock items" });
    const message = buildLowStockMessage(pharmacy.name, low);
    result = await sendSMS(pharmacy.phone, message);
    await supabase.from("alert_logs").insert({ pharmacy_id: pharmacy.id, type: "low_stock", message, status: result.success ? "sent" : "failed", recipient: pharmacy.phone });
    return NextResponse.json(result);
  }

  if (type === "expiry") {
    const cutoff = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
    const { data: batches } = await supabase.from("batches").select("expiry_date, qty, medicines(name)").eq("pharmacy_id", pharmacy.id).lte("expiry_date", cutoff).gt("qty", 0);
    const expiring = (batches ?? []).map((b: any) => {
      const days = Math.floor((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
      return { name: b.medicines?.name ?? "Unknown", days };
    }).sort((a, b) => a.days - b.days);
    if (expiring.length === 0) return NextResponse.json({ success: false, message: "No expiring medicines" });
    const message = buildExpiryMessage(pharmacy.name, expiring);
    result = await sendSMS(pharmacy.phone, message);
    await supabase.from("alert_logs").insert({ pharmacy_id: pharmacy.id, type: "expiry", message, status: result.success ? "sent" : "failed", recipient: pharmacy.phone });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown alert type" }, { status: 400 });
}
