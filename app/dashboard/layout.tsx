import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: pharmacy } = await supabase.from("pharmacies").select("*").eq("user_id", user.id).single();
  const profile = {
    name: pharmacy?.owner_name ?? user.user_metadata?.owner_name ?? "Owner",
    email: user.email ?? "",
    pharmacy_name: pharmacy?.name ?? user.user_metadata?.pharmacy_name ?? "My Pharmacy",
    plan: pharmacy?.plan ?? "free",
  };
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden md:flex md:flex-shrink-0"><Sidebar user={profile} /></div>
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6 pb-20 md:pb-6">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
