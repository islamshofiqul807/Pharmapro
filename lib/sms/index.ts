// SMS provider abstraction — supports BulkSMSBD and fallback mock
// Set NEXT_PUBLIC_SMS_PROVIDER=bulksmsbd in .env and add SMS_API_KEY (server-only)

export type SMSResult = { success: boolean; message: string; cost?: number };

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  const apiKey = process.env.SMS_API_KEY;
  const provider = process.env.SMS_PROVIDER ?? "mock";

  // Normalize BD number
  const phone = to.replace(/\D/g, "").replace(/^880/, "0").replace(/^0/, "880");

  if (!apiKey || provider === "mock") {
    console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
    return { success: true, message: "Mock SMS sent (no API key configured)" };
  }

  if (provider === "bulksmsbd") {
    try {
      const res = await fetch("https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, senderid: "PharmaPro", number: phone, message }),
      });
      const data = await res.json();
      if (data.response_code === 202) return { success: true, message: "SMS sent", cost: data.charge };
      return { success: false, message: data.error_message ?? "SMS failed" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  return { success: false, message: "Unknown SMS provider" };
}

export function buildLowStockMessage(pharmacyName: string, medicines: { name: string; stock: number }[]) {
  const list = medicines.slice(0, 5).map(m => `- ${m.name} (${m.stock} left)`).join("\n");
  const more = medicines.length > 5 ? `\n...and ${medicines.length - 5} more` : "";
  return `[PharmaPro] ${pharmacyName}\nLow stock alert! ${medicines.length} medicine(s) need reorder:\n${list}${more}`;
}

export function buildExpiryMessage(pharmacyName: string, batches: { name: string; days: number }[]) {
  const list = batches.slice(0, 5).map(b => `- ${b.name} (${b.days < 0 ? "EXPIRED" : `${b.days}d left`})`).join("\n");
  const more = batches.length > 5 ? `\n...and ${batches.length - 5} more` : "";
  return `[PharmaPro] ${pharmacyName}\nExpiry alert! ${batches.length} medicine(s) expiring soon:\n${list}${more}`;
}
