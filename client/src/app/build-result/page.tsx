"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type CompatDetail = {
  status: "PASS" | "FAIL" | "WARN";
  rule: string;
  detail: string;
};

type Compatibility = {
  overall: "PASS" | "FAIL" | "WARN";
  passed: number;
  warnings: number;
  failures: number;
  details: CompatDetail[];
};

type ComponentData = Record<string, unknown> & {
  name?: string;
  price?: number;
};

type EvalMetric = {
  score: number;
  threshold: number;
  passed: boolean;
  details?: Record<string, number | Record<string, unknown>>;
  utilization_pct?: number;
  within_range?: boolean;
  checks_passed?: number;
  total_checks?: number;
  score_seconds?: number;
  threshold_seconds?: number;
};

type Evaluation = {
  prediction_accuracy: EvalMetric;
  budget_fit: EvalMetric;
  intended_use_alignment: EvalMetric;
  compatibility_reliability: EvalMetric;
  recommendation_speed: EvalMetric;
};

type BuildResult = {
  tiers: Record<string, string>;
  build: Record<string, ComponentData | null>;
  total: number;
  budget_fit: boolean;
  compatibility: Compatibility;
  evaluation?: Evaluation;
};

type UserInputSummary = {
  min_budget: number;
  max_budget: number;
  primary_activity: string;
  secondary_activity: string | null;
  longevity: string;
  upgrade_open: boolean;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const fmt = (v: number) => currencyFormatter.format(v);

const COMPONENT_LABELS: Record<string, { label: string; icon: string }> = {
  cpu:         { label: "CPU (Processor)",        icon: "⚡" },
  gpu:         { label: "GPU (Graphics Card)",    icon: "🎮" },
  motherboard: { label: "Motherboard",            icon: "🔌" },
  ram:         { label: "RAM (Memory)",           icon: "💾" },
  storage:     { label: "Storage (SSD/HDD)",      icon: "💿" },
  psu:         { label: "Power Supply (PSU)",     icon: "🔋" },
  case:        { label: "Case",                   icon: "🖥️" },
  cpu_cooler:  { label: "CPU Cooler",             icon: "❄️" },
  case_fan:    { label: "Case Fans",              icon: "🌀" },
};

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  PASS: { border: "border-emerald-400/40", bg: "bg-emerald-400/10", text: "text-emerald-200", dot: "bg-emerald-400" },
  WARN: { border: "border-amber-400/40",   bg: "bg-amber-400/10",   text: "text-amber-200",   dot: "bg-amber-400" },
  FAIL: { border: "border-red-400/40",     bg: "bg-red-400/10",     text: "text-red-200",     dot: "bg-red-400" },
};

const TIER_COLORS: Record<string, string> = {
  budget:     "border-slate-400/30 bg-slate-400/10 text-slate-200",
  mid:        "border-blue-400/30 bg-blue-400/10 text-blue-200",
  high:       "border-amber-400/30 bg-amber-400/10 text-amber-200",
  enthusiast: "border-purple-400/30 bg-purple-400/10 text-purple-200",
};

/* ── Page Component ────────────────────────────────────────────────────────── */
export default function BuildResultPage() {
  const [result, setResult] = useState<BuildResult | null>(null);
  const [input, setInput] = useState<UserInputSummary | null>(null);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020617", // slate-950
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 dimensions in points (72 dpi)
      const pdfWidth = 595.28;
      const pdfHeight = 841.89;
      const margin = 24;
      const contentWidth = pdfWidth - margin * 2;
      const scaledHeight = (imgHeight * contentWidth) / imgWidth;
      const contentHeight = pdfHeight - margin * 2;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      // Add background to every page
      let yOffset = 0;
      let pageNum = 0;

      while (yOffset < scaledHeight) {
        if (pageNum > 0) pdf.addPage();

        // Dark background fill
        pdf.setFillColor(2, 6, 23); // slate-950
        pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          margin - yOffset,
          contentWidth,
          scaledHeight
        );

        yOffset += contentHeight;
        pageNum++;
      }

      // Footer on each page
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(
          `SmartBuild — Page ${i} of ${totalPages}`,
          pdfWidth / 2,
          pdfHeight - 12,
          { align: "center" }
        );
      }

      pdf.save("SmartBuild-Recommendation.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("smartbuild_result");
    const rawInput = sessionStorage.getItem("smartbuild_input");
    if (raw) setResult(JSON.parse(raw));
    if (rawInput) setInput(JSON.parse(rawInput));
  }, []);

  if (!result) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-[120px]" />
        </div>
        <div className="relative mx-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10 text-center backdrop-blur">
          <h2 className="font-heading text-2xl">No build result found</h2>
          <p className="mt-3 text-sm text-white/60">
            You haven&apos;t generated a build yet. Start by providing your
            requirements.
          </p>
          <Link
            href="/user-input"
            className="mt-6 inline-block rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-200"
          >
            Start recommendation
          </Link>
        </div>
      </div>
    );
  }

  const buildEntries = Object.entries(result.build).filter(
    ([, v]) => v !== null
  ) as [string, ComponentData][];

  const compat = result.compatibility;

  return (
    <div ref={contentRef} className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10 px-4 sm:px-6 md:px-8 pb-24 pt-8 sm:pt-12">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <Link
            href="/user-input"
            className="flex items-center gap-2 text-xs text-white/50 transition hover:text-white/80 w-fit"
            data-html2canvas-ignore="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Input
          </Link>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            Build Result
          </div>
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Your recommended PC build.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
            Below is a comprehensive breakdown of the AI-recommended components,
            compatibility validation, and total estimated cost.
          </p>
        </header>

        {/* ─── Input Summary ──────────────────────────────────── */}
        {input && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 backdrop-blur">
            <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-heading text-lg">Your Requirements</h2>
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs uppercase tracking-widest text-blue-200">
                Summary
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Budget Range", value: `${fmt(input.min_budget)} – ${fmt(input.max_budget)}` },
                { label: "Primary Activity", value: input.primary_activity },
                { label: "Secondary Activity", value: input.secondary_activity ?? "None" },
                { label: "Expected Longevity", value: input.longevity },
                { label: "Open to Upgrades", value: input.upgrade_open ? "Yes" : "No" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5"
                >
                  <span className="text-white/50">{item.label}</span>
                  <span className="text-white font-medium break-words text-left sm:text-right w-full sm:w-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── System Evaluation ────────────────────────────── */}
        {result.evaluation && (() => {
          const ev = result.evaluation;
          const EVAL_PARAMS = [
            {
              key: "prediction_accuracy" as const,
              label: "Prediction Accuracy",
              icon: "🎯",
              description: "RF model confidence in tier predictions",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "budget_fit" as const,
              label: "Budget Fit",
              icon: "💰",
              description: "Build total within user budget range",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "intended_use_alignment" as const,
              label: "Intended-Use Alignment",
              icon: "🧭",
              description: "Tier allocation matches activity demand",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "compatibility_reliability" as const,
              label: "Compatibility Reliability",
              icon: "🔗",
              description: "Hardware compatibility checks passed",
              format: (m: EvalMetric) =>
                `${m.checks_passed ?? 0}/${m.total_checks ?? 0}`,
              thresholdLabel: () => `100%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "recommendation_speed" as const,
              label: "Recommendation Speed",
              icon: "⚡",
              description: "Pipeline execution time",
              format: (m: EvalMetric) => `${m.score_seconds ?? 0}s`,
              thresholdLabel: (m: EvalMetric) =>
                `≤ ${m.threshold_seconds ?? 15}s`,
              barPct: (m: EvalMetric) => {
                const secs = m.score_seconds ?? 0;
                const max = m.threshold_seconds ?? 15;
                return Math.min(Math.max(0, (1 - secs / max) * 100), 100);
              },
            },
          ];

          const allPassed = EVAL_PARAMS.every((p) => ev[p.key].passed);

          return (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/5 to-transparent p-5 sm:p-7 backdrop-blur shadow-[0_20px_80px_-40px_rgba(139,92,246,0.25)]" data-html2canvas-ignore="true">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl">System Evaluation</h2>
                  <p className="mt-1 text-xs text-white/50">
                    Automated assessment against the 5 key performance indicators
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
                    allPassed
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {allPassed ? "All Passed" : "Needs Attention"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {EVAL_PARAMS.map((param) => {
                  const metric = ev[param.key];
                  const passed = metric.passed;
                  const bar = param.barPct(metric);

                  return (
                    <div
                      key={param.key}
                      className={`group relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                        passed
                          ? "border-emerald-400/20 bg-emerald-400/[0.04] hover:bg-emerald-400/[0.08]"
                          : "border-red-400/20 bg-red-400/[0.04] hover:bg-red-400/[0.08]"
                      }`}
                    >
                      {/* Icon */}
                      <span className="text-xl leading-none">{param.icon}</span>

                      {/* Label */}
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-white/60">
                        {param.label}
                      </p>

                      {/* Score */}
                      <p className="mt-1 font-heading text-2xl text-white">
                        {param.format(metric)}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            passed ? "bg-emerald-400" : "bg-red-400"
                          }`}
                          style={{ width: `${bar}%` }}
                        />
                      </div>

                      {/* Threshold & Status */}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-white/40">
                          {param.thresholdLabel(metric)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            passed ? "text-emerald-300" : "text-red-300"
                          }`}
                        >
                          {passed ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </div>

                      {/* Description tooltip on hover */}
                      <p className="mt-1 text-[10px] text-white/30">
                        {param.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* ─── Component Breakdown ─────────────────────────── */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7 shadow-[0_30px_120px_-80px_rgba(16,185,129,0.5)] backdrop-blur">
            <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-heading text-2xl">Component Breakdown</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
                Build
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              {buildEntries.map(([key, comp]) => {
                const meta = COMPONENT_LABELS[key] ?? {
                  label: key,
                  icon: "🔧",
                };
                const tier = result.tiers[key];
                const tierClass = TIER_COLORS[tier] ?? TIER_COLORS.mid;

                return (
                  <div
                    key={key}
                    className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 text-lg leading-none">
                          {meta.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-white/50">{meta.label}</p>
                          <p className="mt-0.5 text-sm font-medium text-white truncate">
                            {comp.name ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-semibold text-white">
                          {comp.price ? fmt(comp.price) : "—"}
                        </span>
                        {tier && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tierClass}`}
                          >
                            {tier}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Total Cost ────────────────────────────────── */}
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-200/70">
                    Total Estimated Cost
                  </p>
                  <p className="mt-1 font-heading text-2xl text-white">
                    {fmt(result.total)}
                  </p>
                </div>
                <div
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                    result.budget_fit
                      ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-200"
                      : "border-red-400/50 bg-red-400/20 text-red-200"
                  }`}
                >
                  {result.budget_fit ? "✓ Within Budget" : "✗ Over Budget"}
                </div>
              </div>
              {input && (
                <p className="mt-2 text-xs text-emerald-200/60">
                  Your budget: {fmt(input.min_budget)} – {fmt(input.max_budget)}
                </p>
              )}
            </div>
          </div>

          {/* ─── Right Column: Compatibility & Actions ───────── */}
          <div className="flex flex-col gap-6">
            {/* Compatibility Check */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-5 sm:p-7">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-heading text-2xl">Compatibility Check</h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${
                    STATUS_COLORS[compat.overall]?.border ?? ""
                  } ${STATUS_COLORS[compat.overall]?.bg ?? ""} ${
                    STATUS_COLORS[compat.overall]?.text ?? ""
                  }`}
                >
                  {compat.overall === "PASS"
                    ? "All Clear"
                    : compat.overall === "WARN"
                    ? "Warnings"
                    : "Issues Found"}
                </span>
              </div>

              {/* Summary Counters */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Passed", count: compat.passed, color: "emerald" },
                  { label: "Warnings", count: compat.warnings, color: "amber" },
                  { label: "Failures", count: compat.failures, color: "red" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center"
                  >
                    <p
                      className={`font-heading text-xl ${
                        s.color === "emerald"
                          ? "text-emerald-300"
                          : s.color === "amber"
                          ? "text-amber-300"
                          : "text-red-300"
                      }`}
                    >
                      {s.count}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/50">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="mt-5 grid gap-2">
                {compat.details.map((d, i) => {
                  const sc = STATUS_COLORS[d.status];
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border ${sc.border} ${sc.bg} px-4 py-3`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot}`} />
                        <span className={`text-xs font-semibold shrink-0 ${sc.text}`}>
                          {d.status}
                        </span>
                        <span className="text-xs text-white/60 break-words">
                          {d.rule}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/70 pl-4">
                        {d.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tier Predictions */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-heading text-lg">AI Tier Predictions</h2>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-widest text-cyan-200">
                  Model
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(result.tiers).map(([key, tier]) => {
                  const tierClass = TIER_COLORS[tier] ?? TIER_COLORS.mid;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <span className="text-xs text-white/50 capitalize">
                        {key.replace("_", " ")}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0 ${tierClass}`}
                      >
                        {tier}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7" data-html2canvas-ignore="true">
              <h2 className="font-heading text-lg">What&apos;s next?</h2>
              <p className="mt-2 text-xs text-white/60">
                Not satisfied? Go back and adjust your requirements to generate
                a different build.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative flex items-center justify-center gap-2">
                    {downloading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating PDF…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download as PDF
                      </>
                    )}
                  </span>
                </button>
                <Link
                  href="/user-input"
                  className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                >
                  Generate another build
                </Link>
                <Link
                  href="/"
                  className="rounded-2xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/5"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
