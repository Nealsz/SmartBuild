"use client";

import { useEffect, useState } from "react";

// Fields to always hide from the form
const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at"]);

// Fields that should use a number input
const NUMERIC_KEYWORDS = [
  "price", "wattage", "clock", "count", "memory", "capacity",
  "speed", "tdp", "score", "latency", "size", "slots", "volume",
  "max", "min", "rating", "watts",
];

function isNumericField(key: string): boolean {
  const lower = key.toLowerCase();
  return NUMERIC_KEYWORDS.some((kw) => lower.includes(kw));
}

export const CATEGORY_NECESSARY_COLUMNS: Record<string, string[]> = {
  cpu:         ["name", "price", "boost_clock", "core_count", "core_clock", "performance_score", "tdp", "socket"],
  gpu:         ["name", "price", "memory", "core_clock", "boost_clock"],
  ram:         ["name", "price", "speed_mhz", "total_capacity_gb", "first_word_latency", "ddr_gen"],
  storage:     ["name", "price", "capacity"],
  motherboard: ["name", "price", "max_memory", "memory_slots", "socket", "form_factor"],
  psu:         ["name", "price", "wattage"],
  case:        ["name", "price", "external_volume", "type"],
  cpu_cooler:  ["name", "price", "size"],
  case_fan:    ["name", "price", "size"],
};

export const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  price: "Price (₱)",
  boost_clock: "Boost Clock (GHz)",
  core_clock: "Base Clock (GHz)",
  core_count: "Core Count",
  performance_score: "Perf Score",
  tdp: "TDP (W)",
  socket: "Socket",
  memory: "VRAM (GB)",
  speed_mhz: "Speed (MHz)",
  total_capacity_gb: "Capacity (GB)",
  first_word_latency: "Latency (ns)",
  ddr_gen: "DDR Gen",
  capacity: "Capacity",
  max_memory: "Max RAM (GB)",
  memory_slots: "RAM Slots",
  form_factor: "Form Factor",
  wattage: "Wattage (W)",
  external_volume: "Volume (L)",
  type: "Case Type",
  size: "Size (mm)",
};

interface Props {
  isOpen: boolean;
  mode: "create" | "edit";
  category: string;
  initialData?: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export default function ComponentModal({
  isOpen,
  mode,
  category,
  initialData,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const targetFields = CATEGORY_NECESSARY_COLUMNS[category] ?? [
    "name",
    "price",
  ];

  // Populate form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const initialForm: Record<string, string> = {};

    if (mode === "edit" && initialData) {
      for (const field of targetFields) {
        const val = initialData[field];
        initialForm[field] = val == null ? "" : String(val);
      }
    } else {
      for (const field of targetFields) {
        initialForm[field] = "";
      }
    }
    setForm(initialForm);
    setError("");
  }, [isOpen, mode, initialData, category]);

  if (!isOpen) return null;

  const fields = targetFields;

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Convert numeric-looking fields back to numbers
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "" || v === null || v === undefined) {
          payload[k] = null;
        } else if (isNumericField(k) && !isNaN(Number(v))) {
          payload[k] = Number(v);
        } else {
          payload[k] = v;
        }
      }
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {mode === "create" ? "➕ Add Component" : "✏️ Edit Component"}
          </h2>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="text-slate-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          id="component-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5"
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {mode === "create" && fields.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              No fields yet. This form auto-builds when you switch to edit mode
              first, or type a field name below.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((key) => (
              <div key={key}>
                <label
                  htmlFor={`field-${key}`}
                  className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400"
                >
                  {COLUMN_LABELS[key] ?? key.replace(/_/g, " ")}
                </label>
                <input
                  id={`field-${key}`}
                  type={isNumericField(key) ? "number" : "text"}
                  step={isNumericField(key) ? "any" : undefined}
                  value={form[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            id="modal-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            id="modal-save-btn"
            type="submit"
            form="component-form"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-200 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
