"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Truck, Users, AlertTriangle, BarChart3, Settings, LogOut, Cross, Sparkles, TrendingUp, CreditCard, UserCog } from "lucide-react";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard",  label_bn: "ড্যাশবোর্ড",   href: "/dashboard",  icon: LayoutDashboard },
  { label: "Medicines",  label_bn: "ওষুধ",           href: "/medicines",  icon: Package },
  { label: "Sales",      label_bn: "বিক্রয়",         href: "/sales",      icon: ShoppingCart },
  { label: "Purchases",  label_bn: "ক্রয়",           href: "/purchases",  icon: Truck },
  { label: "Suppliers",  label_bn: "সরবরাহকারী",     href: "/suppliers",  icon: Users },
  { label: "Customers",  label_bn: "গ্রাহক",          href: "/customers",  icon: CreditCard },
  { label: "Expiry",     label_bn: "মেয়াদ",           href: "/expiry",     icon: AlertTriangle },
  { label: "Analytics",  label_bn: "বিশ্লেষণ",       href: "/analytics",  icon: TrendingUp },
  { label: "Reports",    label_bn: "রিপোর্ট",         href: "/reports",    icon: BarChart3 },
  { label: "Staff",      label_bn: "কর্মচারী",        href: "/staff",      icon: UserCog },
  { label: "Settings",   label_bn: "সেটিংস",          href: "/settings",   icon: Settings },
];

interface SidebarProps { user: { name: string; email: string; pharmacy_name: string; plan: string }; }

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Cross className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">PharmaPro</p>
          <p className="text-[10px] text-muted-foreground truncate">{user.pharmacy_name}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors group",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              <span className={cn("text-[10px] opacity-0 group-hover:opacity-60 transition-opacity", isActive && "opacity-60")}>{item.label_bn}</span>
            </Link>
          );
        })}
      </nav>

      {user.plan === "free" && (
        <div className="mx-3 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Upgrade to Pro</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">Unlimited medicines · SMS alerts · Staff accounts</p>
          <Button size="sm" className="w-full h-7 text-xs">৳799/month</Button>
        </div>
      )}

      <div className="border-t p-3">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const mainNav = navItems.slice(0, 5);
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex">
        {mainNav.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-5 w-5" /><span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
