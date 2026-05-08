import { Cross } from "lucide-react";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-emerald-900 p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Cross className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl block leading-tight">PharmaPro</span>
            <span className="text-xs text-emerald-300">ফার্মা প্রো</span>
          </div>
        </div>
        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-3xl font-bold leading-relaxed">&quot;সঠিক ওষুধ, সঠিক সময়ে&quot;</p>
            <p className="text-emerald-200 text-xl">&quot;Right medicine, at the right time&quot;</p>
          </blockquote>
          <p className="text-emerald-300">Track inventory, catch expiring medicines, manage sales and suppliers — all from one screen.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "1,200+", label: "Pharmacies", sub: "ফার্মেসি" },
            { value: "0", label: "Expired loss", sub: "মেয়াদ ক্ষতি" },
            { value: "৳799", label: "Per month", sub: "প্রতি মাস" },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/10 p-4 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-emerald-300 mt-1">{s.label}</div>
              <div className="text-xs text-emerald-400">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Cross className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">PharmaPro</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
