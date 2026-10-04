"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, getCategories, type Category } from "@/lib/adminApi";
import AdminTable from "./AdminTable";
import TicketsTable from "./TicketsTable";

const CATEGORY_ICONS: Record<string, string> = {};


export default function AdminDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>("tickets");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [catLoading, setCatLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    const u = localStorage.getItem("sb_admin_username") ?? "admin";
    setUsername(u);
  }, [router]);

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await getCategories();
      setCategories(res.categories);
      const initialCounts: Record<string, number> = {};
      for (const c of res.categories) initialCounts[c.key] = c.count;
      setCounts(initialCounts);
    } catch {
      // token expired → adminApi redirects automatically
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) fetchCategories();
  }, [fetchCategories]);

  function handleLogout() {
    clearToken();
    router.push("/admin/login");
  }

  const selectedCat = categories.find((c) => c.key === selected);

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/10 bg-slate-900 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="font-heading text-sm font-semibold tracking-wide">
            SmartBuild Admin
          </span>
        </div>

        {/* Category list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Reservations
          </p>
          <button
            id="nav-tickets"
            onClick={() => {
              setSelected("tickets");
              setSidebarOpen(false);
            }}
            className={`mb-4 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
              selected === "tickets"
                ? "bg-amber-400/20 text-amber-200 border border-amber-400/40 shadow-sm"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="font-semibold">Store Tickets</span>
            </span>
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              Active
            </span>
          </button>

          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Components
          </p>
          {catLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="mb-1 h-10 animate-pulse rounded-xl bg-white/5"
                />
              ))
            : categories.map((cat) => (
                <button
                  key={cat.key}
                  id={`nav-${cat.key}`}
                  onClick={() => {
                    setSelected(cat.key);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    selected === cat.key
                      ? "bg-amber-400/15 text-amber-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="capitalize">{cat.key.replace(/_/g, " ")}</span>
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                    {(counts[cat.key] ?? cat.count).toLocaleString()}
                  </span>
                </button>
              ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white">{username}</p>
              <p className="text-[10px] text-slate-500">Administrator</p>
            </div>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <button
              id="sidebar-toggle-btn"
              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/10 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <h1 className="font-heading text-lg font-semibold capitalize">
                {selected === "tickets"
                  ? "Store Tickets & Reservations"
                  : selectedCat
                  ? selectedCat.key.replace(/_/g, " ")
                  : "Component Manager"}
              </h1>
              {selected === "tickets" ? (
                <p className="text-xs text-slate-500">
                  Manage walk-in tickets, reservation statuses, and parts stock
                </p>
              ) : selectedCat ? (
                <p className="text-xs text-slate-500">
                  {(counts[selectedCat.key] ?? selectedCat.count).toLocaleString()} entries in Supabase
                </p>
              ) : null}
            </div>
          </div>

          {/* Stats chips & Top Logout Button */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 md:flex">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                ● Supabase connected
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                {categories.reduce((s, c) => s + (counts[c.key] ?? c.count), 0).toLocaleString()} components
              </span>
            </div>

            <div className="flex items-center gap-3 border-l border-white/10 pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-white">{username}</p>
                <p className="text-[10px] text-slate-400">Administrator</p>
              </div>

              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Table panel */}
        <main className="flex-1 overflow-auto">
          {selected === "tickets" ? (
            <TicketsTable />
          ) : selected ? (
            <div className="p-6">
              <AdminTable
                key={selected}
                category={selected}
                onCountChange={(n) =>
                  setCounts((prev) => ({ ...prev, [selected]: n }))
                }
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-600">
              Select an option from the sidebar.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
