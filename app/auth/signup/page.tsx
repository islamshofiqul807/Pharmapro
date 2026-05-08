"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function SignupPage() {
  const [form, setForm] = useState({ pharmacyName: "", ownerName: "", phone: "", email: "", password: "", licenseNo: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { pharmacy_name: form.pharmacyName, owner_name: form.ownerName, phone: form.phone, license_no: form.licenseNo },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      toast({ variant: "destructive", title: "Registration failed", description: error.message });
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold">Registration successful!</h1>
      <p className="text-muted-foreground text-sm">নিবন্ধন সফল! Check your email and click the confirmation link to activate your account.</p>
      <Link href="/auth/login"><Button className="w-full">Go to login</Button></Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register your pharmacy</h1>
        <p className="text-sm text-muted-foreground mt-1">আপনার ফার্মেসি নিবন্ধন করুন</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Pharmacy name *</Label>
            <Input placeholder="Al-Amin Pharmacy" value={form.pharmacyName} onChange={e => setForm({...form, pharmacyName: e.target.value})} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Owner name *</Label>
            <Input placeholder="Mohammad Karim" value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required disabled={loading} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>License number</Label>
            <Input placeholder="Drug license no." value={form.licenseNo} onChange={e => setForm({...form, licenseNo: e.target.value})} disabled={loading} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="pharmacy@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={loading} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Password * (min 8 chars)</Label>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={8} disabled={loading} />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account / নিবন্ধন করুন
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already registered? <Link href="/auth/login" className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
