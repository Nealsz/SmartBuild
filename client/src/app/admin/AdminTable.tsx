import { useEffect, useState, useCallback, useRef } from "react";
import {
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
} from "@/lib/adminApi";
import ComponentModal, {
  CATEGORY_NECESSARY_COLUMNS,
  COLUMN_LABELS,
} from "./ComponentModal";
import DeleteConfirmModal from "./DeleteConfirmModal";

interface Props {
  category: string;
  onCountChange?: (count: number) => void;
}

const SYSTEM_COLS = new Set(["id", "created_at", "updated_at"]);

export default function AdminTable({ category, onCountChange }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Keep callback ref stable to prevent re-render loops
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  });

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listComponents(category, page, pageSize, search);
      setRows(res.data);
      setTotal(res.total);
      setPages(res.pages);
      onCountChangeRef.current?.(res.total);

      const targetCols = CATEGORY_NECESSARY_COLUMNS[category] ?? [
        "name",
        "price",
      ];

      if (res.data.length > 0) {
        const availableCols = Object.keys(res.data[0]);
        const colsToDisplay = targetCols.filter((col) =>
          availableCols.includes(col),
        );
        setColumns(
          colsToDisplay.length > 0
            ? colsToDisplay
            : availableCols.filter((k) => !SYSTEM_COLS.has(k)).slice(0, 6),
        );
      } else {
        setColumns(targetCols);
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to load data.",
        "err",
      );
    } finally {
      setLoading(false);
    }
  }, [category, page, pageSize, search]);

  useEffect(() => {
    setPage(1);
    setRows([]);
    setSearch("");
    setSearchInput("");
  }, [category]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreate(data: Record<string, unknown>) {
    await createComponent(category, data);
    showToast("Component added successfully.");
    fetchData();
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editRow) return;
    const id = String(editRow.id);
    await updateComponent(category, id, data);
    showToast("Component updated successfully.");
    fetchData();
  }

  async function handleDelete() {
    if (!deleteRow) return;
    setDeleteLoading(true);
    try {
      await deleteComponent(category, String(deleteRow.id));
      showToast("Component deleted.");
      setDeleteRow(null);
      fetchData();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Delete failed.",
        "err",
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const renderPaginationBar = (position: "top" | "bottom") => (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400 ${
        position === "bottom" ? "border-t border-white/10 pt-4" : "pb-1"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs">
          Showing <strong className="text-white">{startItem.toLocaleString()}</strong>–
          <strong className="text-white">{endItem.toLocaleString()}</strong> of{" "}
          <strong className="text-white">{total.toLocaleString()}</strong> entries
        </span>

        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <span className="text-xs text-slate-400">Per page:</span>
          <select
            id={`page-size-select-${position}`}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-amber-400/50"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          id={`prev-btn-${position}`}
          type="button"
          onClick={() => {
            if (page > 1) setPage((p) => Math.max(1, p - 1));
          }}
          disabled={page <= 1}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Prev
        </button>

        <span className="px-2 text-xs font-medium">
          Page <strong className="text-amber-300">{page}</strong> of{" "}
          <strong className="text-white">{Math.max(1, pages)}</strong>
        </span>

        <button
          id={`next-btn-${position}`}
          type="button"
          onClick={() => {
            if (page < pages) setPage((p) => Math.min(pages, p + 1));
          }}
          disabled={page >= pages}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
            toast.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              id="table-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name…"
              className="w-64 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/10"
            />
            <button
              id="table-search-btn"
              type="submit"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition hover:bg-white/10"
              >
                Clear
              </button>
            )}
          </form>

          <button
            id="add-component-btn"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-200"
          >
            + Add Component
          </button>
        </div>

        {/* Top Pagination Control */}
        {renderPaginationBar("top")}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {COLUMN_LABELS[col] ?? col.replace(/_/g, " ")}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3">
                      <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                    </td>
                  ))}
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  No components found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={String(row.id ?? idx)}
                  className="border-b border-white/5 transition hover:bg-white/5"
                >
                  {columns.map((col) => {
                    const rawVal = row[col];
                    let displayStr = rawVal == null ? "—" : String(rawVal);
                    if (col === "price" && rawVal != null && !isNaN(Number(rawVal))) {
                      displayStr = `₱${Number(rawVal).toLocaleString("en-PH", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}`;
                    }
                    return (
                      <td
                        key={col}
                        className="max-w-xs truncate px-4 py-3 text-slate-300"
                        title={rawVal == null ? "" : String(rawVal)}
                      >
                        {rawVal == null ? (
                          <span className="text-slate-600">—</span>
                        ) : col === "stock" && !isNaN(Number(rawVal)) ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              Number(rawVal) === 0
                                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                                : Number(rawVal) <= 3
                                ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                Number(rawVal) === 0
                                  ? "bg-red-400"
                                  : Number(rawVal) <= 3
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                            />
                            {Number(rawVal).toLocaleString()} in stock
                          </span>
                        ) : (
                          displayStr
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        id={`edit-btn-${idx}`}
                        onClick={() => setEditRow(row)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        id={`delete-btn-${idx}`}
                        onClick={() => setDeleteRow(row)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Control */}
      {renderPaginationBar("bottom")}

      {/* Modals */}
      <ComponentModal
        isOpen={createOpen}
        mode="create"
        category={category}
        initialData={rows[0]}
        onSave={handleCreate}
        onClose={() => setCreateOpen(false)}
      />
      <ComponentModal
        isOpen={!!editRow}
        mode="edit"
        category={category}
        initialData={editRow ?? undefined}
        onSave={handleEdit}
        onClose={() => setEditRow(null)}
      />
      <DeleteConfirmModal
        isOpen={!!deleteRow}
        componentName={
          deleteRow?.name
            ? String(deleteRow.name)
            : `ID ${deleteRow?.id}`
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteRow(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
