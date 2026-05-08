"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Scan, X, Camera, Keyboard, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/utils";

type Medicine = { id: string; name: string; sale_price: number; stock_qty: number; unit: string; generic_name?: string; };

type BarcodeScannerProps = {
  open: boolean;
  onClose: () => void;
  onFound: (medicine: Medicine) => void;
  pharmacyId: string;
};

export function BarcodeScanner({ open, onClose, onFound, pharmacyId }: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "keyboard">("keyboard");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<Medicine | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);

  // Keyboard barcode scanner support (USB scanners type fast)
  useEffect(() => {
    if (!open || mode !== "keyboard") return;
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyRef.current > 100) bufferRef.current = "";
      lastKeyRef.current = now;
      if (e.key === "Enter" && bufferRef.current.length > 3) {
        lookup(bufferRef.current);
        bufferRef.current = "";
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, mode]);

  // Camera scanner using getUserMedia + canvas analysis
  useEffect(() => {
    if (!open || mode !== "camera") { stopCamera(); return; }
    startCamera();
    return () => stopCamera();
  }, [open, mode]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s);
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
    } catch { setError("Camera access denied. Use manual entry."); setMode("keyboard"); }
  }

  function stopCamera() {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }

  async function lookup(code: string) {
    setSearching(true);
    setError("");
    setResult(null);
    const supabase = createClient();
    // Search by barcode field first, then by name
    const { data } = await supabase.from("medicines")
      .select("id, name, generic_name, sale_price, stock_qty, unit")
      .eq("pharmacy_id", pharmacyId)
      .or(`barcode.eq.${code},name.ilike.%${code}%`)
      .limit(1)
      .single();
    if (data) { setResult(data); }
    else { setError(`No medicine found for: "${code}"`); }
    setSearching(false);
  }

  function handleAdd() {
    if (!result) return;
    onFound(result);
    setResult(null); setManualCode(""); setError("");
    onClose();
  }

  function reset() { setResult(null); setError(""); setManualCode(""); }

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scan className="h-4 w-4" />Barcode Scanner</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[{ key: "keyboard" as const, label: "USB Scanner / Manual", icon: Keyboard }, { key: "camera" as const, label: "Camera", icon: Camera }].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); reset(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${mode === m.key ? "bg-background shadow" : "text-muted-foreground"}`}>
              <m.icon className="h-3.5 w-3.5" />{m.label}
            </button>
          ))}
        </div>

        {mode === "keyboard" ? (
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
              <Scan className="h-8 w-8 text-primary/50 mx-auto mb-2" />
              <p className="text-sm font-medium">Scan with USB barcode scanner</p>
              <p className="text-xs text-muted-foreground mt-1">Point scanner at barcode — it types automatically</p>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Or type barcode / medicine name..." value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && manualCode && lookup(manualCode)} />
              <Button variant="outline" onClick={() => lookup(manualCode)} disabled={!manualCode || searching}>
                {searching ? "..." : "Search"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden bg-black aspect-video relative">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-24 border-2 border-primary rounded-lg opacity-60" />
              </div>
              <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs">Align barcode within the frame</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">Camera scanning coming soon — use USB scanner or manual entry for now</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-900">{result.name}</p>
                {result.generic_name && <p className="text-xs text-emerald-700">{result.generic_name}</p>}
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="font-bold text-emerald-700">{formatCurrency(result.sale_price)}</span>
                  <span className="text-emerald-600">Stock: {result.stock_qty} {result.unit}</span>
                </div>
              </div>
            </div>
            <Button className="w-full h-9" onClick={handleAdd}>Add to cart</Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {searching && (
          <div className="text-center py-4">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-2">Looking up medicine...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
