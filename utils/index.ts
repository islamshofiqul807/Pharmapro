import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatDate(date: string | Date) { return format(new Date(date), "dd MMM yyyy"); }
export function formatDateShort(date: string | Date) { return format(new Date(date), "dd/MM/yyyy"); }
export function formatCurrency(amount: number) { return "\u09F3" + amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
export function getInitials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
export function getDaysUntilExpiry(expiryDate: string): number { return differenceInDays(new Date(expiryDate), new Date()); }
export function getExpiryStatus(expiryDate: string): "expired" | "critical" | "warning" | "ok" {
  const days = getDaysUntilExpiry(expiryDate);
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}
export function getExpiryColor(status: string) {
  const colors: Record<string, string> = {
    expired: "bg-red-100 text-red-700 border-red-200",
    critical: "bg-orange-100 text-orange-700 border-orange-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return colors[status] ?? "bg-gray-100 text-gray-600";
}
