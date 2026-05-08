"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const description = error.message.includes("Email not confirmed")
        ? "Please check your email and confirm your account first."
        : error.message.includes("Invalid login credentials")
        ? "Invalid email or password."
        : error.message;
      toast({ variant: "destructive", title: "Login failed", description });
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">আপনার ফার্মেসি অ্যাকাউন্টে সাইন ইন করুন</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email / ইমেইল</Label>
          <Input id="email" type="email" placeholder="pharmacy@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password / পাসওয়ার্ড</Label>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In / সাইন ইন
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New pharmacy?{" "}
        <Link href="/auth/signup" className="text-primary font-medium hover:underline">Create account / নিবন্ধন করুন</Link>
      </p>
    </div>
  );
}
