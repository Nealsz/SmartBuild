"use client";

import { StoreTicket } from "@/lib/adminApi";

interface TicketDetailModalProps {
  ticket: StoreTicket | null;
  onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const fmt = (v: number) => currencyFormatter.format(v);

const COMPONENT_LABELS: Record<string, { label: string }> = {
  cpu:         { label: "CPU (Processor)" },
  gpu:         { label: "GPU (Graphics Card)" },
  motherboard: { label: "Motherboard" },
  ram:         { label: "RAM (Memory)" },
  storage:     { label: "Storage (SSD/HDD)" },
  psu:         { label: "Power Supply (PSU)" },
  case:        { label: "Case" },
  cpu_cooler:  { label: "CPU Cooler" },
  case_fan:    { label: "Case Fans" },
};

export default function TicketDetailModal({ ticket, onClose }: TicketDetailModalProps) {
  if (!ticket) return null;

  const build = (ticket.build_data || {}) as Record<string, any>;
  const expiresAt = new Date(ticket.expires_at);
  const now = new Date();
  const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold tracking-wider text-amber-300">
                {ticket.ticket_code}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  ticket.status === "Reserved"
                    ? "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                    : ticket.status === "Building"
                    ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
                    : ticket.status === "Completed"
                    ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                    : ticket.status === "Cancelled" || ticket.status === "Expired"
                    ? "bg-red-400/20 text-red-300 border border-red-400/30"
                    : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                }`}
              >
                {ticket.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/50">
              Generated on {new Date(ticket.created_at).toLocaleDateString()} &bull;{" "}
              {diffDays > 0 ? (
                <span className="text-amber-200 font-medium">Expires in {diffDays} days</span>
              ) : (
                <span className="text-red-300 font-medium">Expired</span>
              )}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Customer Information */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs">
          <div>
            <span className="text-white/40 block text-[10px] uppercase tracking-wider">Customer Name</span>
            <span className="font-semibold text-white mt-0.5 block">{ticket.customer_name}</span>
          </div>
          <div>
            <span className="text-white/40 block text-[10px] uppercase tracking-wider">Contact Phone</span>
            <span className="font-medium text-white/90 mt-0.5 block">{ticket.customer_phone || "—"}</span>
          </div>
          <div>
            <span className="text-white/40 block text-[10px] uppercase tracking-wider">Email</span>
            <span className="font-medium text-white/90 mt-0.5 block truncate">{ticket.customer_email || "—"}</span>
          </div>
        </div>

        {/* Stock Status Banner */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${ticket.is_stock_deducted ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
            <span className="text-white/70">Inventory Stock Status:</span>
          </div>
          <span className={`font-semibold ${ticket.is_stock_deducted ? "text-emerald-300" : "text-white/50"}`}>
            {ticket.is_stock_deducted ? "Reserved (1 unit deducted from store stock)" : "Not deducted yet (Pending)"}
          </span>
        </div>

        {/* Component Breakdown */}
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
            Reserved Build Components
          </h3>
          <div className="grid gap-2">
            {Object.keys(COMPONENT_LABELS).map((catKey) => {
              const meta = COMPONENT_LABELS[catKey];
              const entry = build[catKey];
              if (!entry) return null;

              const comp = typeof entry === "object" && "main" in entry ? entry.main : entry;
              if (!comp) return null;

              return (
                <div
                  key={catKey}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.04] p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <div className="min-w-0">
                      <span className="text-[10px] text-white/40 block">{meta.label}</span>
                      <span className="font-medium text-white truncate block">{comp.name || "Unknown Component"}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-white shrink-0">
                    {comp.price ? fmt(Number(comp.price)) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Cost */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <span className="text-xs uppercase tracking-wider text-amber-200/80 font-medium">Total Build Price</span>
          <span className="font-heading text-2xl font-bold text-white">{fmt(ticket.total_price)}</span>
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition"
          >
            Print Ticket
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-amber-300 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
