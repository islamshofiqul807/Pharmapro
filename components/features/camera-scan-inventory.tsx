"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, CheckCircle2, AlertCircle, RotateCcw,
  Loader2, ChevronRight, Barcode, FlipHorizontal, Keyboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/utils";

type Medicine = {
  id: string; name: string; generic_name: string; brand: string;
  category: string; unit: string; purchase_price: number; sale_price: number;
  stock_qty: number; reorder_level: number; rack_location: string; barcode?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pharmacyId: string;
  onMedicineFound: (medicine: Medicine) => void;
  onAddNew: (prefill: { barcode: string }) => void;
};

type ScanState = "scanning" | "looking" | "found" | "not_found";

export function CameraScanInventory({ open, onClose, pharmacyId, onMedicineFound, onAddNew }: Props) {
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [inputMode, setInputMode] = useState<"camera" | "manual">("camera");
  const [detectedCode, setDetectedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [foundMedicine, setFoundMedicine] = useState<Medicine | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scanLinePos, setScanLinePos] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const scanLineDir = useRef(1);
  const hasDetected = useRef(false);

  // Animate scan line
  useEffect(() => {
    if (!open || scanState !== "scanning" || inputMode !== "camera") return;
    let pos = 0;
    let dir = 1;
    const tick = () => {
      pos += dir * 1.5;
      if (pos >= 100) dir = -1;
      if (pos <= 0) dir = 1;
      setScanLinePos(pos);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [open, scanState, inputMode]);

  // Camera + ZXing lifecycle
  useEffect(() => {
    if (open && inputMode === "camera" && scanState === "scanning") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [open, inputMode, facingMode]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setScanState("scanning");
        setDetectedCode("");
        setManualCode("");
        setFoundMedicine(null);
        setCameraError("");
        setInputMode("camera");
        hasDetected.current = false;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function startScanner() {
    stopScanner();
    setCameraError("");
    hasDetected.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Dynamic import so ZXing doesn't load on server
      const { BrowserMultiFormatReader } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      reader.decodeFromStream(stream, videoRef.current!, (result) => {
        if (result && !hasDetected.current) {
          hasDetected.current = true;
          lookupBarcode(result.getText());
        }
      });
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow access and try again.");
      } else {
        setCameraError("Could not open camera. Use the manual entry tab instead.");
      }
    }
  }

  function stopScanner() {
    try { readerRef.current?.reset(); } catch {}
    readerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function lookupBarcode(code: string) {
    stopScanner();
    setDetectedCode(code);
    setScanState("looking");

    const supabase = createClient();
    const { data } = await supabase
      .from("medicines")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .eq("barcode", code)
      .maybeSingle();

    if (data) {
      setFoundMedicine(data);
      setScanState("found");
    } else {
      setScanState("not_found");
    }
  }

  function rescan() {
    setScanState("scanning");
    setDetectedCode("");
    setFoundMedicine(null);
    setManualCode("");
    hasDetected.current = false;
    if (inputMode === "camera") startScanner();
  }

  function switchMode(mode: "camera" | "manual") {
    setInputMode(mode);
    rescan();
  }

  return (
    <Dialog open={open} onOpenChange={() => { stopScanner(); onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Barcode className="h-4 w-4 text-primary" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 mx-4 mt-3 bg-muted rounded-lg p-1">
          {([
            { key: "camera", label: "Camera", Icon: Camera },
            { key: "manual", label: "Type / USB scanner", Icon: Keyboard },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                inputMode === key
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-5 pt-3 space-y-3">

          {/* ── CAMERA VIEWFINDER ── */}
          {inputMode === "camera" && scanState === "scanning" && (
            <>
              {cameraError ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-red-600 max-w-[230px]">{cameraError}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={startScanner}>Retry camera</Button>
                    <Button variant="outline" size="sm" onClick={() => switchMode("manual")}>Type manually</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                    {/* Scan frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-56 h-28">
                        {/* Corner brackets */}
                        {[
                          "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-sm",
                          "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-sm",
                          "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-sm",
                          "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-sm",
                        ].map(cls => (
                          <div key={cls} className={`absolute w-5 h-5 border-white ${cls}`} />
                        ))}
                        {/* Animated scan line */}
                        <div
                          className="absolute left-1 right-1 h-px bg-primary shadow-[0_0_6px_2px_rgba(99,102,241,0.8)]"
                          style={{ top: `${scanLinePos}%`, transition: "top 16ms linear" }}
                        />
                      </div>
                    </div>

                    {/* Flip button */}
                    <button
                      onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition"
                      title="Flip camera"
                    >
                      <FlipHorizontal className="h-4 w-4" />
                    </button>

                    {/* Loading spinner before camera opens */}
                    {!streamRef.current && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Align the barcode inside the frame — detection is automatic
                  </p>
                </>
              )}
            </>
          )}

          {/* ── MANUAL / USB ENTRY ── */}
          {inputMode === "manual" && scanState === "scanning" && (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-dashed border-primary/25 bg-primary/5 p-5 text-center space-y-1.5">
                <Barcode className="h-8 w-8 text-primary/40 mx-auto" />
                <p className="text-sm font-medium">USB barcode scanner or manual entry</p>
                <p className="text-xs text-muted-foreground">
                  Plug in your USB scanner and scan — it types the code automatically.
                  Or type the barcode number below.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Type or scan barcode..."
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && manualCode.trim() && lookupBarcode(manualCode.trim())}
                  autoFocus
                />
                <Button
                  onClick={() => lookupBarcode(manualCode.trim())}
                  disabled={!manualCode.trim()}
                >
                  Search
                </Button>
              </div>
            </div>
          )}

          {/* ── LOOKING UP ── */}
          {scanState === "looking" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">Looking up barcode…</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{detectedCode}</p>
              </div>
            </div>
          )}

          {/* ── FOUND ── */}
          {scanState === "found" && foundMedicine && (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-900 truncate">{foundMedicine.name}</p>
                    {foundMedicine.generic_name && (
                      <p className="text-xs text-emerald-700">{foundMedicine.generic_name}</p>
                    )}
                    {foundMedicine.brand && (
                      <p className="text-xs text-emerald-600">{foundMedicine.brand}</p>
                    )}
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      Current stock: {foundMedicine.stock_qty} {foundMedicine.unit}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1.5" onClick={rescan}>
                  <RotateCcw className="h-3.5 w-3.5" />Scan again
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => { onMedicineFound(foundMedicine); onClose(); }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />Select medicine
                </Button>
              </div>
            </div>
          )}

          {/* ── NOT FOUND ── */}
          {scanState === "not_found" && (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Not in inventory</p>
                    <p className="text-xs text-amber-700 font-mono mt-0.5">{detectedCode}</p>
                    <p className="text-xs text-amber-700 mt-2">
                      This barcode isn't registered yet. Add the medicine now and the barcode will be saved —
                      next time it scans instantly.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1.5" onClick={rescan}>
                  <RotateCcw className="h-3.5 w-3.5" />Scan again
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => { onAddNew({ barcode: detectedCode }); onClose(); }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />Add to inventory
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
