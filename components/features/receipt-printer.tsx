"use client";
import { useRef } from "react";
import { Printer, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/utils";

type ReceiptItem = { name: string; qty: number; unit_price: number; sale_price: number; };

type ReceiptProps = {
  open: boolean;
  onClose: () => void;
  sale: {
    id: string;
    customer_name: string;
    sale_date: string;
    total: number;
    discount: number;
    paid: number;
    items: ReceiptItem[];
  };
  pharmacy: {
    name: string;
    address?: string;
    phone?: string;
    license_no?: string;
  };
};

export function ReceiptPrinter({ open, onClose, sale, pharmacy }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  function printReceipt() {
    const content = receiptRef.current?.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win || !content) return;
    win.document.write(`
      <html><head><title>Receipt - ${sale.id.slice(0, 8)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 12px; max-width: 300px; margin: 0 auto; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .item-name { max-width: 160px; }
        .total-row { font-weight: bold; font-size: 14px; }
        @media print { body { padding: 0; } button { display: none; } }
      </style></head>
      <body onload="window.print(); window.close();">
      ${content}
      </body></html>
    `);
    win.document.close();
  }

  async function downloadPDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 200], orientation: "portrait" });
    const w = 80;
    let y = 8;
    const line = (text: string, x: number, align: "left" | "center" | "right" = "left", bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(text, x, y, { align });
      y += 5;
    };

    doc.setFontSize(14);
    line(pharmacy.name, w / 2, "center", true);
    doc.setFontSize(8);
    if (pharmacy.address) line(pharmacy.address, w / 2, "center");
    if (pharmacy.phone) line(`Tel: ${pharmacy.phone}`, w / 2, "center");
    if (pharmacy.license_no) line(`License: ${pharmacy.license_no}`, w / 2, "center");

    y += 2;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(5, y, w - 5, y); y += 4;

    doc.setFontSize(9);
    line(`Receipt #: ${sale.id.slice(0, 8).toUpperCase()}`, 5);
    line(`Date: ${formatDate(sale.sale_date)}`, 5);
    line(`Customer: ${sale.customer_name}`, 5);

    y += 1; doc.line(5, y, w - 5, y); y += 4;

    doc.setFontSize(8);
    line("Medicine", 5, "left", true);
    doc.setFont("helvetica", "bold");
    doc.text("Qty", 50, y - 5, { align: "center" });
    doc.text("Amount", w - 5, y - 5, { align: "right" });

    doc.line(5, y, w - 5, y); y += 4;

    doc.setFontSize(8);
    sale.items.forEach(item => {
      doc.setFont("helvetica", "normal");
      doc.text(item.name.slice(0, 22), 5, y);
      doc.text(String(item.qty), 50, y, { align: "center" });
      doc.text(formatCurrency(item.sale_price * item.qty), w - 5, y, { align: "right" });
      y += 5;
    });

    y += 1; doc.line(5, y, w - 5, y); y += 4;

    doc.setFontSize(9);
    if (sale.discount > 0) {
      doc.text("Discount:", 5, y);
      doc.text(`-${formatCurrency(sale.discount)}`, w - 5, y, { align: "right" });
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL:", 5, y);
    doc.text(formatCurrency(sale.total), w - 5, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.line(5, y, w - 5, y); y += 5;
    doc.text("Thank you! আসুন আবার।", w / 2, y, { align: "center" });
    y += 4;
    doc.text("Powered by PharmaPro", w / 2, y, { align: "center" });

    doc.save(`receipt-${sale.id.slice(0, 8)}.pdf`);
  }

  const subtotal = sale.items.reduce((s, i) => s + i.sale_price * i.qty, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Receipt / রসিদ
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div ref={receiptRef} className="border rounded-lg p-4 font-mono text-xs bg-white text-black space-y-1 max-h-[60vh] overflow-y-auto">
          <div className="center bold text-sm">{pharmacy.name}</div>
          {pharmacy.address && <div className="center">{pharmacy.address}</div>}
          {pharmacy.phone && <div className="center">Tel: {pharmacy.phone}</div>}
          {pharmacy.license_no && <div className="center">License: {pharmacy.license_no}</div>}
          <div className="line" />
          <div className="row"><span>Receipt#:</span><span>{sale.id.slice(0, 8).toUpperCase()}</span></div>
          <div className="row"><span>Date:</span><span>{formatDate(sale.sale_date)}</span></div>
          <div className="row"><span>Customer:</span><span>{sale.customer_name}</span></div>
          <div className="line" />
          <div className="row bold">
            <span className="item-name">Medicine</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          <div className="line" />
          {sale.items.map((item, i) => (
            <div key={i}>
              <div className="item-name">{item.name}</div>
              <div className="row">
                <span className="text-gray-500">{formatCurrency(item.sale_price)} × {item.qty}</span>
                <span>{formatCurrency(item.sale_price * item.qty)}</span>
              </div>
            </div>
          ))}
          <div className="line" />
          {sale.discount > 0 && (
            <div className="row"><span>Discount:</span><span>-{formatCurrency(sale.discount)}</span></div>
          )}
          <div className="row total-row"><span>TOTAL:</span><span>{formatCurrency(sale.total)}</span></div>
          <div className="row"><span>Paid:</span><span>{formatCurrency(sale.paid)}</span></div>
          <div className="line" />
          <div className="center">Thank you! আসুন আবার।</div>
          <div className="center text-gray-400">Powered by PharmaPro</div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={printReceipt}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button className="flex-1 gap-2" onClick={downloadPDF}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
