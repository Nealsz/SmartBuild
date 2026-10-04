"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import StoreTicketModal from "./StoreTicketModal";

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

type ComponentGroup = {
  main: ComponentData | null;
  alternatives?: ComponentData[];
};

type BuildResult = {
  tiers: Record<string, string>;
  build: Record<string, ComponentGroup | ComponentData | null>;
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
  resolution_target: string;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
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

const PCIE5_CHIPSETS = ["Z790", "Z890", "X870", "X670", "TRX"];

function runCompatibilityCheck(
  buildMains: Record<string, ComponentData | null>
): Compatibility {
  const details: CompatDetail[] = [];

  const cpu = buildMains.cpu;
  const ram = buildMains.ram;
  const stor = buildMains.storage;
  const mb = buildMains.motherboard;
  const psu = buildMains.psu;
  const caseComp = buildMains.case;
  const cool = buildMains.cpu_cooler;

  // 1. CPU ↔ Motherboard Socket
  if (cpu && mb) {
    const cpuSocket = String(cpu.socket ?? "");
    const mbSocket = String(mb.socket ?? "");
    if (cpuSocket && mbSocket && cpuSocket === mbSocket) {
      details.push({
        status: "PASS",
        rule: "CPU ↔ Motherboard Socket",
        detail: `${cpuSocket} matches`,
      });
    } else if (cpuSocket && mbSocket) {
      details.push({
        status: "FAIL",
        rule: "CPU ↔ Motherboard Socket",
        detail: `CPU needs ${cpuSocket}, motherboard has ${mbSocket}`,
      });
    }
  }

  // 2. RAM DDR Gen ↔ Motherboard
  if (ram && mb) {
    const ddr = String(ram.ddr_gen ?? "");
    const mbName = String(mb.name ?? "");
    if (ddr === "DDR5" && mbName.includes("DDR4")) {
      details.push({
        status: "FAIL",
        rule: "RAM ↔ Motherboard DDR Gen",
        detail: "RAM is DDR5 but motherboard only supports DDR4",
      });
    } else if (ddr === "DDR4" && mbName.includes("DDR5")) {
      details.push({
        status: "FAIL",
        rule: "RAM ↔ Motherboard DDR Gen",
        detail: "RAM is DDR4 but motherboard only supports DDR5",
      });
    } else if (ddr) {
      details.push({
        status: "PASS",
        rule: "RAM ↔ Motherboard DDR Gen",
        detail: `${ddr} compatible with selected motherboard`,
      });
    }
  }

  // 3. RAM Capacity ≤ Motherboard Max Memory
  if (ram && mb) {
    const totalCap = Number(ram.total_capacity_gb ?? 0);
    const maxMem = Number(mb.max_memory ?? 0);
    if (totalCap > 0 && maxMem > 0) {
      if (totalCap <= maxMem) {
        details.push({
          status: "PASS",
          rule: "RAM Capacity ≤ Motherboard Max Memory",
          detail: `${totalCap}GB ≤ ${maxMem}GB`,
        });
      } else {
        details.push({
          status: "FAIL",
          rule: "RAM Capacity ≤ Motherboard Max Memory",
          detail: `${totalCap}GB exceeds motherboard max of ${maxMem}GB`,
        });
      }
    }
  }

  // 4. Motherboard Form Factor ↔ Case
  if (mb && caseComp) {
    const formCompat: Record<string, string[]> = {
      ATX: ["ATX Mid Tower", "ATX Full Tower", "ATX Desktop", "ATX Test Bench"],
      "Micro ATX": [
        "MicroATX Mini Tower",
        "MicroATX Mid Tower",
        "MicroATX Desktop",
        "ATX Mid Tower",
        "ATX Full Tower",
      ],
      "Mini ITX": [
        "Mini ITX Tower",
        "Mini ITX Desktop",
        "MicroATX Mini Tower",
        "ATX Mid Tower",
        "ATX Full Tower",
      ],
      EATX: ["ATX Full Tower", "XL ATX"],
    };
    const moboFf = String(mb.form_factor ?? "");
    const caseType = String(caseComp.type ?? "");
    const allowed = formCompat[moboFf] ?? [];
    if (allowed.includes(caseType)) {
      details.push({
        status: "PASS",
        rule: "Motherboard Form Factor ↔ Case",
        detail: `${moboFf} fits in ${caseType}`,
      });
    } else if (moboFf && caseType) {
      details.push({
        status: "FAIL",
        rule: "Motherboard Form Factor ↔ Case",
        detail: `${moboFf} does not fit in ${caseType}`,
      });
    }
  }

  // 5. PSU Wattage
  if (psu && cpu) {
    const psuWatt = Number(psu.wattage ?? 0);
    const cpuTdp = Number(cpu.tdp ?? 65);
    const minWatt = Math.round((cpuTdp + 200) * 1.2);
    if (psuWatt > 0) {
      if (psuWatt >= minWatt) {
        details.push({
          status: "PASS",
          rule: "PSU Wattage ≥ System TDP + 20% Headroom",
          detail: `${psuWatt}W ≥ ${minWatt}W required`,
        });
      } else {
        details.push({
          status: "FAIL",
          rule: "PSU Wattage ≥ System TDP + 20% Headroom",
          detail: `${psuWatt}W insufficient — need at least ${minWatt}W`,
        });
      }
    }
  }

  // 6. Storage PCIe 5.0 ↔ Motherboard
  if (stor && mb) {
    const interfaceStr = String(stor.interface ?? "");
    const mbName = String(mb.name ?? "");
    if (interfaceStr.includes("PCIe 5.0")) {
      if (PCIE5_CHIPSETS.some((c) => mbName.includes(c))) {
        details.push({
          status: "PASS",
          rule: "Storage PCIe 5.0 ↔ Motherboard",
          detail: "Motherboard chipset supports PCIe 5.0 M.2",
        });
      } else {
        details.push({
          status: "WARN",
          rule: "Storage PCIe 5.0 ↔ Motherboard",
          detail:
            "Could not confirm PCIe 5.0 M.2 support — verify motherboard spec sheet",
        });
      }
    } else if (interfaceStr) {
      details.push({
        status: "PASS",
        rule: "Storage Interface ↔ Motherboard",
        detail: `${interfaceStr} is widely supported`,
      });
    }
  }

  // 7. CPU Cooler Adequacy
  if (cool && cpu) {
    const cpuTdp = Number(cpu.tdp ?? 65);
    const coolSize = Number(cool.size ?? 0);
    const isAio = coolSize > 0;
    if (cpuTdp >= 125 && !isAio) {
      details.push({
        status: "WARN",
        rule: "CPU Cooler ↔ CPU TDP",
        detail: `CPU TDP is ${cpuTdp}W — an AIO liquid cooler is recommended`,
      });
    } else {
      const coolLabel = isAio ? `AIO ${coolSize}mm` : "Air cooler";
      details.push({
        status: "PASS",
        rule: "CPU Cooler ↔ CPU TDP",
        detail: `${coolLabel} adequate for ${cpuTdp}W TDP`,
      });
    }
  }

  const failures = details.filter((d) => d.status === "FAIL").length;
  const warnings = details.filter((d) => d.status === "WARN").length;
  const passed = details.length - failures - warnings;

  const overall = failures > 0 ? "FAIL" : warnings > 0 ? "WARN" : "PASS";

  return {
    overall,
    passed,
    warnings,
    failures,
    details,
  };
}

/* ── Page Component ────────────────────────────────────────────────────────── */
export default function BuildResultPage() {
  const [result, setResult] = useState<BuildResult | null>(null);
  const [input, setInput] = useState<UserInputSummary | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
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

  const handleSwitchComponent = (categoryKey: string, altIndex: number) => {
    if (!result) return;

    const currentCategory = result.build[categoryKey];
    if (
      !currentCategory ||
      typeof currentCategory !== "object" ||
      !("main" in currentCategory)
    ) {
      return;
    }

    const group = currentCategory as ComponentGroup;
    if (!group.main || !group.alternatives || !group.alternatives[altIndex]) return;

    const oldMain = group.main;
    const newMain = group.alternatives[altIndex];

    const newAlternatives = [...group.alternatives];
    newAlternatives[altIndex] = oldMain;

    const updatedBuild = {
      ...result.build,
      [categoryKey]: {
        main: newMain,
        alternatives: newAlternatives,
      },
    };

    const newTotal = Object.values(updatedBuild).reduce((sum, item) => {
      if (!item) return sum;
      const m =
        typeof item === "object" && "main" in item
          ? (item as { main?: ComponentData }).main
          : (item as ComponentData);
      return sum + (m && m.price ? Number(m.price) : 0);
    }, 0);

    const budgetWithin = input
      ? input.min_budget <= newTotal && newTotal <= input.max_budget
      : true;

    // Rerun compatibility check on active main picks
    const mainComponents: Record<string, ComponentData | null> = {};
    for (const [k, v] of Object.entries(updatedBuild)) {
      if (!v) continue;
      mainComponents[k] =
        typeof v === "object" && "main" in v
          ? (v as ComponentGroup).main
          : (v as ComponentData);
    }
    const updatedCompat = runCompatibilityCheck(mainComponents);

    let updatedEval = result.evaluation;
    if (updatedEval && input) {
      const budgetMax = input.max_budget;
      const budgetMin = input.min_budget;
      let budgetScore = 100.0;
      if (newTotal > budgetMax) {
        const overshoot = (newTotal - budgetMax) / budgetMax;
        budgetScore = Math.max(0, Math.round((1 - overshoot) * 1000) / 10);
      } else if (newTotal < budgetMin) {
        const undershoot = (budgetMin - newTotal) / budgetMin;
        budgetScore = Math.max(0, Math.round((1 - undershoot) * 1000) / 10);
      }

      const totalChecks =
        updatedCompat.passed + updatedCompat.warnings + updatedCompat.failures;
      const compatScore =
        totalChecks > 0
          ? Math.round(
              ((totalChecks - updatedCompat.failures) / totalChecks) * 1000
            ) / 10
          : 100.0;

      updatedEval = {
        ...updatedEval,
        budget_fit: {
          ...updatedEval.budget_fit,
          score: budgetScore,
          passed: budgetScore >= 90,
          utilization_pct:
            budgetMax > 0
              ? Math.round((newTotal / budgetMax) * 1000) / 10
              : 0,
          within_range: budgetWithin,
        },
        compatibility_reliability: {
          ...updatedEval.compatibility_reliability,
          score: compatScore,
          passed: compatScore === 100.0,
          checks_passed: totalChecks - updatedCompat.failures,
          total_checks: totalChecks,
        },
      };
    }

    const updatedResult: BuildResult = {
      ...result,
      build: updatedBuild,
      total: Math.round(newTotal * 100) / 100,
      budget_fit: budgetWithin,
      compatibility: updatedCompat,
      evaluation: updatedEval,
    };

    setResult(updatedResult);
    sessionStorage.setItem("smartbuild_result", JSON.stringify(updatedResult));
  };

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
                { label: "Target Display", value: input.resolution_target },
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
              description: "RF model confidence in tier predictions",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "budget_fit" as const,
              label: "Budget Fit",
              description: "Build total within user budget range",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "intended_use_alignment" as const,
              label: "Intended-Use Alignment",
              description: "Tier allocation matches activity demand",
              format: (m: EvalMetric) => `${m.score}%`,
              thresholdLabel: (m: EvalMetric) => `≥ ${m.threshold}%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "compatibility_reliability" as const,
              label: "Compatibility Reliability",
              description: "Hardware compatibility checks passed",
              format: (m: EvalMetric) =>
                `${m.checks_passed ?? 0}/${m.total_checks ?? 0}`,
              thresholdLabel: () => `100%`,
              barPct: (m: EvalMetric) => Math.min(m.score, 100),
            },
            {
              key: "recommendation_speed" as const,
              label: "Recommendation Speed",
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
                      {/* Label */}
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">
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
                          {passed ? "PASS" : "FAIL"}
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
              {Object.entries(result.build).map(([key, entry]) => {
                if (!entry) return null;

                // Support both new {main, alternatives} structure and legacy flat structure
                const mainComp: ComponentData | null =
                  typeof entry === "object" && "main" in entry
                    ? (entry as ComponentGroup).main
                    : (entry as ComponentData);

                const alternatives: ComponentData[] =
                  typeof entry === "object" && "alternatives" in entry && Array.isArray((entry as ComponentGroup).alternatives)
                    ? ((entry as ComponentGroup).alternatives as ComponentData[])
                    : [];

                if (!mainComp) return null;

                const meta = COMPONENT_LABELS[key] ?? {
                  label: key,
                };
                const tier = result.tiers[key];
                const tierClass = TIER_COLORS[tier] ?? TIER_COLORS.mid;

                return (
                  <div
                    key={key}
                    className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]"
                  >
                    {/* Primary Component Pick */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-white/50">{meta.label}</p>
                            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                              Main Option
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-white truncate">
                            {mainComp.name ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-semibold text-white">
                          {mainComp.price ? fmt(Number(mainComp.price)) : "—"}
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

                    {/* Alternative Options */}
                    {alternatives.length > 0 && (
                      <div className="mt-3 border-t border-white/10 pt-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium flex items-center justify-between">
                          <span>Alternative Options (Click to Swap):</span>
                        </p>
                        <div className="grid gap-1.5">
                          {alternatives.map((alt, idx) => (
                            <div
                              key={`${key}-alt-${alt.name ?? idx}-${idx}`}
                              className="flex items-center justify-between text-xs rounded-xl bg-white/[0.04] px-3 py-2 border border-white/5 hover:border-amber-300/30 transition group/alt"
                            >
                              <span className="text-white/80 truncate mr-2 flex items-center gap-1.5 min-w-0">
                                <span className="text-amber-300/80 font-mono text-[10px] shrink-0">#{idx + 2}</span>
                                <span className="truncate">{alt.name ?? "Alternative"}</span>
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-white/60 font-medium">
                                  {alt.price ? fmt(Number(alt.price)) : "—"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchComponent(key, idx)}
                                  className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 shadow-sm transition hover:bg-amber-300 hover:text-slate-950 flex items-center gap-1 cursor-pointer active:scale-95"
                                >
                                  <span>Swap</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                  {result.budget_fit ? "Within Budget" : "Over Budget"}
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
                  onClick={() => setTicketModalOpen(true)}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all hover:shadow-amber-400/40 hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    <span>Get Store Ticket / Reserve in Store</span>
                  </span>
                </button>
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

      {/* Store Ticket Modal */}
      <StoreTicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        totalPrice={result.total}
        buildData={result.build}
      />
    </div>
  );
}
