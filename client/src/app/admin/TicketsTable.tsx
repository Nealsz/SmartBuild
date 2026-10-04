"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listAdminTickets,
  updateAdminTicketStatus,
  deleteAdminTicket,
  StoreTicket,
} from "@/lib/adminApi";
import TicketDetailModal from "./TicketDetailModal";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Reserved",
  "Building",
  "Completed",
  "Cancelled",
  "Expired",
] as const;

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const fmt = (v: number) => currencyFormatter.format(v);

export default function TicketsTable() {
  const [tickets, setTickets] = useState<StoreTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<StoreTicket | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminTickets({
        page,
        pageSize: 25,
        status: statusFilter,
        q: search.trim(),
      });
      setTickets(res.data);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err.message || "Failed to load store tickets.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    try {
      const res = await updateAdminTicketStatus(ticketId, newStatus);
      showToast(res.message, "success");
      // Update local ticket row
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: res.status as any, is_stock_deducted: res.is_stock_deducted }
            : t
        )
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update ticket status.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (ticket: StoreTicket) => {
    if (!confirm(`Are you sure you want to delete ticket ${ticket.ticket_code}? If parts were reserved, stock will be restored.`)) {
      return;
    }
    try {
      await deleteAdminTicket(ticket.id);
      showToast(`Ticket ${ticket.ticket_code} deleted successfully.`, "info");
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      showToast(err.message || "Failed to delete ticket.", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied code "${text}" to clipboard!`, "info");
  };

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            toast.type === "success"
              ? "border-emerald-400/40 bg-emerald-950/90 text-emerald-200 shadow-emerald-900/50"
              : toast.type === "error"
              ? "border-red-400/40 bg-red-950/90 text-red-200 shadow-red-900/50"
              : "border-blue-400/40 bg-slate-900/90 text-blue-200 shadow-blue-900/50"
          }`}
        >
          <span className="font-medium text-xs uppercase tracking-wider">{toast.type === "success" ? "Done" : toast.type === "error" ? "Error" : "Info"}</span>
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/50 hover:text-white text-xs">×</button>
        </div>
      )}

      {/* Top Banner & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Store Tickets &amp; Reservations
          </h1>
          <p className="mt-1 text-xs text-white/60">
            Customer reservations with 30-day auto-expiry and dynamic inventory stock management.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition w-fit"
        >
          <span>↻ Refresh</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs">
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${
                statusFilter === st
                  ? "bg-amber-300 text-slate-950 font-semibold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs select-none">&#x2315;</span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search code, customer, phone..."
            className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3.5 py-2 pl-9 text-xs text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-5 py-4 font-semibold">Ticket Code</th>
                <th className="px-5 py-4 font-semibold">Customer</th>
                <th className="px-5 py-4 font-semibold">Total Price</th>
                <th className="px-5 py-4 font-semibold">Status &amp; Stock</th>
                <th className="px-5 py-4 font-semibold">Validity</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-white/10" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-white/10" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-20 rounded bg-white/10" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-24 rounded-full bg-white/10" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-28 rounded bg-white/10" /></td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto h-7 w-20 rounded bg-white/10" /></td>
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40">
                    <p className="text-sm font-medium">No store tickets found</p>
                    <p className="mt-1 text-xs text-white/30">
                      When customers generate a build and take a store ticket, it will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const expiresAt = new Date(t.expires_at);
                  const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 3600 * 24));
                  const isExpired = diffDays <= 0;

                  return (
                    <tr key={t.id} className="transition hover:bg-white/[0.02]">
                      {/* Ticket Code */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold tracking-wider text-amber-300">
                            {t.ticket_code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(t.ticket_code)}
                            title="Copy Code"
                            className="rounded p-1 text-white/30 hover:bg-white/10 hover:text-white transition text-[10px] font-mono"
                          >
                            copy
                          </button>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{t.customer_name}</p>
                        <p className="text-[11px] text-white/40">
                          {t.customer_phone || t.customer_email || "Walk-in Buyer"}
                        </p>
                      </td>

                      {/* Total Price */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-white">{fmt(t.total_price)}</span>
                      </td>

                      {/* Status Selector & Stock Indicator */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={t.status}
                            disabled={updatingId === t.id}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            className={`w-fit rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition focus:outline-none cursor-pointer ${
                              t.status === "Reserved"
                                ? "border-blue-400/50 bg-blue-500/20 text-blue-200"
                                : t.status === "Building"
                                ? "border-purple-400/50 bg-purple-500/20 text-purple-200"
                                : t.status === "Completed"
                                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                : t.status === "Cancelled" || t.status === "Expired"
                                ? "border-red-400/50 bg-red-500/20 text-red-200"
                                : "border-amber-400/50 bg-amber-500/20 text-amber-200"
                            }`}
                          >
                            <option value="Pending" className="bg-slate-900 text-white">Pending</option>
                            <option value="Reserved" className="bg-slate-900 text-blue-200">Reserved (Deduct Stock)</option>
                            <option value="Building" className="bg-slate-900 text-purple-200">Building</option>
                            <option value="Completed" className="bg-slate-900 text-emerald-200">Completed</option>
                            <option value="Cancelled" className="bg-slate-900 text-red-200">Cancelled (Restore Stock)</option>
                          </select>

                          {/* Stock pill */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className={`h-1.5 w-1.5 rounded-full ${t.is_stock_deducted ? "bg-emerald-400" : "bg-white/20"}`} />
                            <span className={t.is_stock_deducted ? "text-emerald-300/80 font-medium" : "text-white/40"}>
                              {t.is_stock_deducted ? "Stock reserved (-1)" : "Stock unreserved"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="px-5 py-4">
                        {isExpired ? (
                          <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                            Expired
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-white/80 font-medium">{diffDays} days left</span>
                            <span className="text-[10px] text-white/40">
                              Until {expiresAt.toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedTicket(t)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white transition"
                          >
                            View Build
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25 transition"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Total count */}
        <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-4 text-xs text-white/40">
          <span>Total: {total.toLocaleString()} tickets</span>
          <span>Automatic 30-day ticket lifecycle active</span>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
