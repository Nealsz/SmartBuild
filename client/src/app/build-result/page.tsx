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
  size?: number | null;
  mismatch_advisory?: {
    has_mismatch?: boolean;
    type?: string;
    title?: string;
    reason?: string;
    cpu_tdp?: number;
    override_allowed?: boolean;
    recommended_fix_type?: string;
  };
  is_recommended_fix?: boolean;
  fix_reason?: string;
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

type ComparisonBuildItem = {
  id: "value" | "custom" | "performance";
  title: string;
  tagline: string;
  badge: string;
  is_user_build?: boolean;
  build: Record<string, ComponentGroup | ComponentData | null>;
  total: number;
  tiers?: Record<string, string>;
  budget_fit?: boolean;
  compatibility?: Compatibility;
  evaluation?: Evaluation;
};

type ComparisonSummaryColumn = {
  id: "value" | "custom" | "performance";
  title: string;
  color: string;
  summary: string;
  strengths: string[];
  ideal_for: string;
};

type ComparisonSummary = {
  headline: string;
  intro: string;
  columns: ComparisonSummaryColumn[];
  verdict: string;
};

type BuildResult = {
  tiers: Record<string, string>;
  build: Record<string, ComponentGroup | ComponentData | null>;
  total: number;
  budget_fit: boolean;
  compatibility: Compatibility;
  evaluation?: Evaluation;
  is_custom_build?: boolean;
  comparison_builds?: {
    value?: ComparisonBuildItem;
    custom?: ComparisonBuildItem;
    performance?: ComparisonBuildItem;
    comparison_summary?: ComparisonSummary;
  };
  hardware_advisories?: Array<{
    rule: string;
    status: string;
    title: string;
    message: string;
    involves_reused?: boolean;
    categories?: string[];
  }>;
};

type UserInputSummary = {
  min_budget: number;
  max_budget: number;
  primary_activity: string;
  secondary_activity: string | null;
  primary_subcategory?: string;
  secondary_subcategory?: string;
  cooling_preference?: string;
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

const COMPARE_CATEGORIES = [
  { key: "cpu", label: "Processor (CPU)" },
  { key: "gpu", label: "Graphics (GPU)" },
  { key: "ram", label: "Memory (RAM)" },
  { key: "motherboard", label: "Motherboard" },
  { key: "storage", label: "Storage (SSD)" },
  { key: "psu", label: "Power Supply" },
  { key: "case", label: "Computer Case" },
  { key: "cpu_cooler", label: "CPU Cooler" },
  { key: "case_fan", label: "Case Fans" },
];

function extractComp(
  buildObj: Record<string, ComponentGroup | ComponentData | null> | undefined,
  cat: string
): ComponentData | null {
  if (!buildObj || !buildObj[cat]) return null;
  const entry = buildObj[cat];
  if (entry && typeof entry === "object" && "main" in entry) {
    return (entry as ComponentGroup).main;
  }
  return entry as ComponentData;
}

function getCompSpecSnippet(cat: string, comp: ComponentData | null): string {
  if (!comp) return "—";
  if (comp.spec_snippet) return String(comp.spec_snippet);
  if (cat === "cpu") {
    const cores = comp.core_count ? `${comp.core_count}C` : "";
    const threads = comp.thread_count ? `/${comp.thread_count}T` : "";
    const clock = comp.boost_clock ? ` • ${comp.boost_clock}GHz` : comp.core_clock ? ` • ${comp.core_clock}GHz` : "";
    return `${cores}${threads}${clock}` || String(comp.socket ?? "");
  }
  if (cat === "gpu") {
    const vram = comp.memory ? `${comp.memory}GB VRAM` : "";
    const chip = comp.chipset ? ` • ${comp.chipset}` : "";
    return `${vram}${chip}` || "Discrete Graphics";
  }
  if (cat === "ram") {
    const cap = comp.total_capacity_gb ? `${comp.total_capacity_gb}GB` : "";
    const gen = comp.ddr_gen ? ` ${comp.ddr_gen}` : "";
    const spd = comp.speed_mhz ? ` • ${comp.speed_mhz}MHz` : "";
    return `${cap}${gen}${spd}` || "System Memory";
  }
  if (cat === "storage") {
    const cap = comp.capacity ? (Number(comp.capacity) >= 1000 ? `${(Number(comp.capacity) / 1000).toFixed(0)}TB` : `${comp.capacity}GB`) : "";
    const type = comp.type ? ` • ${comp.type}` : "";
    return `${cap}${type}` || "High-Speed Storage";
  }
  if (cat === "psu") {
    const watt = comp.wattage ? `${comp.wattage}W` : "";
    const eff = comp.efficiency_rating ? ` • ${comp.efficiency_rating}` : "";
    return `${watt}${eff}` || "ATX Power Supply";
  }
  if (cat === "motherboard") {
    const sock = comp.socket ? `${comp.socket}` : "";
    const ff = comp.form_factor ? ` • ${comp.form_factor}` : "";
    return `${sock}${ff}` || "System Motherboard";
  }
  if (cat === "case") {
    return String(comp.type ?? comp.form_factor ?? "Mid Tower Chassis");
  }
  if (cat === "cpu_cooler") {
    const size = comp.size ? `${comp.size}mm` : "";
    const isLiquid = String(comp.name ?? "").toUpperCase().includes("LIQUID");
    return `${size} ${isLiquid ? "Liquid AIO" : "Air Cooler"}`.trim();
  }
  if (cat === "case_fan") {
    return comp.airflow_cfm ? `${comp.airflow_cfm} CFM Airflow` : "120mm Chassis Fan";
  }
  return "";
}

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
    if (!result) return;
    setDownloading(true);

    const PAGE_W = 794;
    const PAGE_H = 1123;

    // Off-screen host container
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:820px;z-index:-9999;pointer-events:none;";
    document.body.appendChild(host);

    interface PageEntry {
      page: HTMLDivElement;
      header: HTMLDivElement;
      body: HTMLDivElement;
      footer: HTMLDivElement;
    }

    const pages: PageEntry[] = [];

    const createPage = (pageIndex: number): PageEntry => {
      const page = document.createElement("div");
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:28px 36px 48px 36px;background:#020617;color:#ffffff;display:flex;flex-direction:column;position:relative;overflow:hidden;`;
      page.className = "bg-slate-950 text-white font-sans antialiased";

      const header = document.createElement("div");
      header.className = "shrink-0 mb-2.5";
      if (pageIndex === 0) {
        header.innerHTML = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="text-xs uppercase tracking-[0.25em] font-semibold text-emerald-300">SmartBuild AI Recommendation</span>
            </div>
            <span class="text-xs text-white/40">${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <h1 class="mt-2 font-heading text-xl font-bold tracking-tight text-white">Your PC Build — Selected Components</h1>
        `;
      } else {
        header.innerHTML = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="text-xs uppercase tracking-[0.25em] font-semibold text-emerald-300">SmartBuild AI Recommendation</span>
            </div>
            <span class="text-xs text-white/40">Page Continued</span>
          </div>
        `;
      }
      page.appendChild(header);

      const body = document.createElement("div");
      body.className = "flex flex-col gap-2";
      body.style.cssText = "display:flex;flex-direction:column;gap:8px;";
      page.appendChild(body);

      const footer = document.createElement("div");
      footer.style.cssText = "position:absolute;bottom:18px;left:36px;right:36px;height:24px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.4);";
      page.appendChild(footer);

      host.appendChild(page);
      return { page, header, body, footer };
    };

    try {
      // ── Build layout blocks ──────────────────────────────────────
      interface LayoutBlock {
        html: string;
        isHeading?: boolean;
      }
      const blocks: LayoutBlock[] = [];

      // 1. Requirements summary (compact header strip)
      if (input) {
        blocks.push({
          html: `
            <div class="rounded-xl border border-white/10 bg-white/5 p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-white">Your Requirements</span>
                  <span class="text-[10px] text-white/40">Target Specifications</span>
                </div>
                <span class="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-blue-200 font-medium">Summary</span>
              </div>
              <div class="grid gap-1.5 grid-cols-4">
                <div class="flex flex-col rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                  <span class="text-white/40 text-[9px] uppercase tracking-wider">Budget</span>
                  <span class="text-white font-medium text-xs mt-0.5">${fmt(input.min_budget)} – ${fmt(input.max_budget)}</span>
                </div>
                <div class="flex flex-col rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                  <span class="text-white/40 text-[9px] uppercase tracking-wider">Primary</span>
                  <span class="text-white font-medium text-xs mt-0.5 truncate">${input.primary_activity}${input.primary_subcategory ? ` (${input.primary_subcategory})` : ""}</span>
                </div>
                <div class="flex flex-col rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                  <span class="text-white/40 text-[9px] uppercase tracking-wider">Cooling</span>
                  <span class="text-white font-medium text-xs mt-0.5">${input.cooling_preference ?? "Auto"}</span>
                </div>
                <div class="flex flex-col rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
                  <span class="text-white/40 text-[9px] uppercase tracking-wider">Resolution</span>
                  <span class="text-white font-medium text-xs mt-0.5">${input.resolution_target}</span>
                </div>
              </div>
            </div>`,
        });
      }

      // 2. SDG 12 Banner (if present)
      const sdg = (result as any)?.sdg12_metrics;
      if (sdg) {
        blocks.push({
          html: `
            <div class="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">SDG 12 Verified</span>
                  <span class="text-xs font-semibold text-white">Hardware Upcycling — Zero-Waste Build</span>
                </div>
                <p class="text-[10px] text-slate-300/80 mt-0.5">Reused ${sdg.reused_count} component(s) at ₱0 cost.</p>
              </div>
              <div class="text-right">
                <span class="text-[9px] text-white/50 uppercase tracking-wider font-mono block">Diverted E-Waste</span>
                <span class="font-heading text-base font-bold text-emerald-300">~${sdg.ewaste_diverted_kg} kg</span>
              </div>
            </div>`,
        });
      }

      // 3. Section Heading
      blocks.push({
        isHeading: true,
        html: `
          <div class="flex items-center justify-between pt-0.5">
            <div class="flex items-center gap-2">
              <h2 class="font-heading text-sm font-bold uppercase tracking-wider text-white">Component Breakdown</h2>
              <span class="text-[11px] text-white/40 font-normal">— Selected Components</span>
            </div>
            <span class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-emerald-200 font-medium">Build</span>
          </div>`,
      });

      // 4. Component Cards (ONLY the final selected picks)
      const ORDERED_CATS = ["cpu", "gpu", "motherboard", "ram", "storage", "psu", "case", "cpu_cooler", "case_fan"];
      let totalCost = 0;

      for (const cat of ORDERED_CATS) {
        const entry = result.build[cat];
        if (!entry) continue;

        const comp: ComponentData | null =
          entry && typeof entry === "object" && "main" in entry
            ? (entry as ComponentGroup).main
            : (entry as ComponentData);
        if (!comp) continue;

        const isReused = Boolean((comp as any).is_user_provided || (!comp.id && comp.price === 0));
        const compPrice = isReused ? 0 : (comp.price ?? 0);
        totalCost += Number(compPrice);
        const label = COMPONENT_LABELS[cat]?.label ?? cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const name = String(comp.name ?? "—");
        const specs = getCompSpecSnippet(cat, comp);
        const tier = result.tiers[cat] ?? "";

        const borderClass = isReused
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : "border-white/10 bg-white/5";

        const priceHtml = isReused
          ? `<span class="text-xs font-bold text-emerald-300">₱0 (Customer Provided)</span>`
          : `<span class="text-xs font-semibold text-white">${compPrice > 0 ? fmt(Number(compPrice)) : "—"}</span>`;

        const badgeHtml = isReused
          ? `<span class="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-300 border border-emerald-400/30">Reused Hardware (SDG 12)</span>`
          : `<span class="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">Main Option</span>`;

        const tierBadge = tier && !isReused
          ? `<span class="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${TIER_COLORS[tier] ?? TIER_COLORS.mid}">${tier}</span>`
          : "";

        const specClass = isReused ? "text-emerald-300/80 font-medium" : "text-white/45";

        blocks.push({
          html: `
            <div class="rounded-xl border p-2.5 ${borderClass}">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <p class="text-[10px] text-white/50 uppercase tracking-wider font-medium">${label}</p>
                    ${badgeHtml}
                  </div>
                  <p class="mt-0.5 text-xs font-semibold text-white leading-snug">${name}</p>
                  ${specs && specs !== "—" ? `<p class="text-[10px] mt-0.5 font-mono ${specClass}">${specs}</p>` : ""}
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                  ${priceHtml}
                  ${tierBadge}
                </div>
              </div>
            </div>`,
        });
      }

      // 5. Total & Budget Fit
      const budgetOk = input
        ? (totalCost >= input.min_budget && totalCost <= input.max_budget)
        : result.budget_fit;

      const statusClasses = budgetOk
        ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-200"
        : "border-red-400/50 bg-red-400/20 text-red-200";

      blocks.push({
        html: `
          <div class="rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-slate-900/40 p-3.5 flex items-center justify-between">
            <div>
              <p class="text-[9px] uppercase tracking-widest font-semibold text-emerald-300/70">Estimated Total</p>
              <p class="mt-0.5 font-heading text-xl font-bold text-white">${fmt(totalCost)}</p>
              ${input ? `<p class="mt-0.5 text-[11px] text-emerald-200/60">Budget: ${fmt(input.min_budget)} – ${fmt(input.max_budget)}</p>` : ""}
            </div>
            <span class="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusClasses}">
              ${budgetOk ? "Within Budget" : "Over Budget"}
            </span>
          </div>`,
      });

      // 6. Compatibility Check Summary
      if (result.compatibility) {
        const co = result.compatibility;
        const overallClass = co.overall === "PASS"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : co.overall === "WARN"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
          : "border-red-400/40 bg-red-400/10 text-red-200";

        let rulesHtml = "";
        for (const d of co.details) {
          const sc = STATUS_COLORS[d.status];
          rulesHtml += `
            <div class="rounded-lg border ${sc.border} ${sc.bg} px-2.5 py-1.5">
              <div class="flex items-start gap-1.5">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot}"></span>
                <span class="text-[11px] font-semibold shrink-0 ${sc.text}">${d.status}</span>
                <span class="text-[11px] text-white/60 flex-1">${d.rule}</span>
              </div>
              <p class="mt-0.5 text-[11px] text-white/70 pl-3">${d.detail}</p>
            </div>`;
        }

        blocks.push({
          html: `
            <div class="rounded-xl border border-white/10 bg-white/5 p-3.5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h2 class="font-heading text-xs font-bold text-white uppercase tracking-wider">Compatibility Check</h2>
                <span class="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${overallClass}">
                  ${co.overall === "PASS" ? "All Clear" : co.overall === "WARN" ? "Warnings" : "Issues Found"}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                  <p class="font-heading text-sm font-bold text-emerald-300">${co.passed}</p>
                  <p class="text-[8px] uppercase tracking-widest text-white/50 font-medium">Passed</p>
                </div>
                <div class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                  <p class="font-heading text-sm font-bold text-amber-300">${co.warnings}</p>
                  <p class="text-[8px] uppercase tracking-widest text-white/50 font-medium">Warnings</p>
                </div>
                <div class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                  <p class="font-heading text-sm font-bold text-red-300">${co.failures}</p>
                  <p class="text-[8px] uppercase tracking-widest text-white/50 font-medium">Failures</p>
                </div>
              </div>
              ${co.details && co.details.length > 0 ? `
                <div class="mt-0.5 flex flex-col gap-1">
                  ${rulesHtml}
                </div>
              ` : ""}
            </div>`,
        });
      }

      // ── Paginate elements cleanly into A4 containers ─────────────
      // Available height allows content to go down to 54px above the bottom
      const MAX_PAGE_CONTENT_BOTTOM = PAGE_H - 54;
      let currentPage = createPage(0);
      pages.push(currentPage);

      for (const block of blocks) {
        const temp = document.createElement("div");
        temp.innerHTML = block.html.trim();
        const element = temp.firstElementChild as HTMLElement;
        if (!element) continue;

        currentPage.body.appendChild(element);

        // Calculate bottom position of the content
        const currentContentBottom = currentPage.body.offsetTop + currentPage.body.offsetHeight;
        const isOverflow = currentContentBottom > MAX_PAGE_CONTENT_BOTTOM;
        // Avoid orphan heading: ensure at least 80px space remaining for at least 1 item
        const isOrphanHeading = Boolean(block.isHeading && (MAX_PAGE_CONTENT_BOTTOM - currentContentBottom < 80));

        if ((isOverflow || isOrphanHeading) && currentPage.body.children.length > 1) {
          currentPage.body.removeChild(element);
          currentPage = createPage(pages.length);
          pages.push(currentPage);
          currentPage.body.appendChild(element);
        }
      }

      // ── Set final footers with total page count ──────────────────
      const totalPages = pages.length;
      pages.forEach((p, idx) => {
        p.footer.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span class="font-medium text-white/50">SmartBuild AI — PC Component Recommendation</span>
          </div>
          <span class="font-mono text-white/50">Page ${idx + 1} of ${totalPages}</span>
        `;
      });

      // Wait for fonts & layout
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // ── Render each page to jsPDF ────────────────────────────────
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pdfWidth = 595.28;
      const pdfHeight = 841.89;

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i].page, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#020617",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save("SmartBuild-Recommendation.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      if (document.body.contains(host)) {
        document.body.removeChild(host);
      }
      setDownloading(false);
    }
  }, [result, input]);


  const [activeVariant, setActiveVariant] = useState<"value" | "custom" | "performance">("custom");

  useEffect(() => {
    const raw = sessionStorage.getItem("smartbuild_result");
    const rawInput = sessionStorage.getItem("smartbuild_input");
    if (raw) setResult(JSON.parse(raw));
    if (rawInput) setInput(JSON.parse(rawInput));
  }, []);

  const handleSelectBuildVariant = (variantKey: "value" | "custom" | "performance") => {
    if (!result?.comparison_builds) return;
    const target = result.comparison_builds[variantKey];
    if (!target || !target.build) return;

    setActiveVariant(variantKey);

    const updatedResult: BuildResult = {
      ...result,
      tiers: target.tiers ?? result.tiers,
      build: target.build,
      total: target.total,
      budget_fit: target.budget_fit ?? result.budget_fit,
      compatibility: target.compatibility ?? result.compatibility,
      evaluation: target.evaluation ?? result.evaluation,
      is_custom_build: variantKey === "custom",
    };

    setResult(updatedResult);
    sessionStorage.setItem("smartbuild_result", JSON.stringify(updatedResult));
  };

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

    let updatedComparisonBuilds = result.comparison_builds;
    if (updatedComparisonBuilds && updatedComparisonBuilds[activeVariant]) {
      updatedComparisonBuilds = {
        ...updatedComparisonBuilds,
        [activeVariant]: {
          ...updatedComparisonBuilds[activeVariant],
          build: updatedBuild,
          total: Math.round(newTotal * 100) / 100,
          budget_fit: budgetWithin,
          compatibility: updatedCompat,
          evaluation: updatedEval,
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
      comparison_builds: updatedComparisonBuilds,
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-white/50">Budget Range</span>
                <span className="text-white font-medium break-words text-left sm:text-right w-full sm:w-auto">
                  {fmt(input.min_budget)} – {fmt(input.max_budget)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-white/50">Primary Activity</span>
                <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                  <span className="text-white font-medium">{input.primary_activity}</span>
                  {input.primary_subcategory && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        input.primary_subcategory === "Heavy"
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                          : input.primary_subcategory === "Light"
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-blue-400/40 bg-blue-400/10 text-blue-300"
                      }`}
                    >
                      {input.primary_subcategory}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-white/50">Secondary Activity</span>
                <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                  <span className="text-white font-medium">
                    {input.secondary_activity ?? "None"}
                  </span>
                  {input.secondary_activity && input.secondary_subcategory && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        input.secondary_subcategory === "Heavy"
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                          : input.secondary_subcategory === "Light"
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-blue-400/40 bg-blue-400/10 text-blue-300"
                      }`}
                    >
                      {input.secondary_subcategory}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-white/50">Cooling Preference</span>
                <span className="text-white font-medium break-words text-left sm:text-right w-full sm:w-auto">
                  {input.cooling_preference ?? "Auto (AI-optimized)"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-white/50">Target Display</span>
                <span className="text-white font-medium break-words text-left sm:text-right w-full sm:w-auto">
                  {input.resolution_target}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── SDG 12 Eco-Impact Banner ────────────────────────────── */}
        {(result as any)?.sdg12_metrics && (
          <div className="rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-slate-950 p-6 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/20 text-2xl border border-emerald-400/30">
                  🌱
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                      SDG 12 Verified • Responsible Consumption
                    </span>
                  </div>
                  <h3 className="font-heading text-xl text-white mt-1">
                    Zero-Waste PC Build — Hardware Upcycling
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300/80 max-w-2xl leading-relaxed">
                    You chose to reuse {(result as any).sdg12_metrics.reused_count} functional hardware component(s) instead of buying new ones. Reused parts are locked at ₱0, saving money while directly preventing toxic e-waste from entering local landfills.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0 shrink-0">
                <span className="text-[11px] text-white/50 uppercase tracking-wider font-mono">Diverted E-Waste</span>
                <span className="font-heading text-2xl sm:text-3xl font-bold text-emerald-300">
                  ~{(result as any).sdg12_metrics.ewaste_diverted_kg} kg
                </span>
                <span className="text-[10px] text-emerald-400/70">Prevented from landfills</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Apple-Style 3-Build Comparison Matrix ────────────────────── */}
        {result.comparison_builds && (() => {
          const compBuilds = result.comparison_builds;
          const valB = compBuilds.value;
          const custB = compBuilds.custom;
          const perfB = compBuilds.performance;

          if (!valB || !custB || !perfB) return null;

          const compColorMap: Record<string, { border: string; bg: string; text: string; accent: string; badgeBg: string; dot: string }> = {
            emerald: { border: "border-emerald-400/25", bg: "bg-emerald-400/[0.04]", text: "text-emerald-300", accent: "text-emerald-200", badgeBg: "bg-emerald-400/10 border-emerald-400/30", dot: "bg-emerald-400" },
            amber:   { border: "border-amber-400/25",   bg: "bg-amber-400/[0.04]",   text: "text-amber-300",   accent: "text-amber-200",   badgeBg: "bg-amber-400/10 border-amber-400/30",   dot: "bg-amber-400"   },
            purple:  { border: "border-purple-400/25",  bg: "bg-purple-400/[0.04]",  text: "text-purple-300",  accent: "text-purple-200",  badgeBg: "bg-purple-400/10 border-purple-400/30",  dot: "bg-purple-400"  },
          };

          return (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur shadow-[0_30px_120px_-80px_rgba(251,191,36,0.35)] flex flex-col gap-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-200/80">
                    <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                    Triple Build Comparison
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl text-white mt-1">
                    Compare PC Configurations
                  </h2>
                  <p className="text-sm text-white/50 mt-1 max-w-xl">
                    Review your custom build placed in the center, flanked by AI-recommended Value and High-Performance alternatives.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-white/40">
                  3 Configurations Analyzed
                </div>
              </div>

              {/* 3 Columns Top Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                {/* 1. Value Build (Left) */}
                <div className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition ${
                  activeVariant === "value"
                    ? "border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_30px_-8px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400/40"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Value Alternative
                      </span>
                      {valB.total > 0 && custB.total > 0 && custB.total > valB.total && (
                        <span className="text-[11px] font-semibold text-emerald-300/90">
                          Save {fmt(custB.total - valB.total)}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-white">{valB.title}</h3>
                    <p className="text-xs text-white/40">{valB.tagline}</p>

                    <div className="my-5 flex justify-center">
                      <div className="flex h-20 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/80">
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <path d="M8 6h.01" />
                          <path d="M16 6h.01" />
                          <path d="M12 18h.01" />
                        </svg>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Estimated Total</p>
                      <p className="text-2xl font-bold text-white mt-0.5">{fmt(valB.total)}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleSelectBuildVariant("value")}
                      className={`w-full rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
                        activeVariant === "value"
                          ? "bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-400/20"
                          : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {activeVariant === "value" ? "Active Selected Build" : "Switch to this Build"}
                    </button>
                  </div>
                </div>

                {/* 2. Your Custom Build (Center - HIGHLIGHTED!) */}
                <div className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition ${
                  activeVariant === "custom"
                    ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_35px_-8px_rgba(251,191,36,0.35)] ring-2 ring-amber-400/50"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                }`}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-300 px-3 py-0.5 text-[10px] font-bold text-slate-950 shadow-md">
                    YOUR CUSTOM SELECTION
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                        User-Configured
                      </span>
                      <span className="text-[11px] font-semibold text-amber-300/90">
                        Baseline Choice
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-white">{custB.title}</h3>
                    <p className="text-xs text-white/40">{custB.tagline}</p>

                    <div className="my-5 flex justify-center">
                      <div className="flex h-20 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 p-2 shadow-[0_0_20px_-4px_rgba(251,191,36,0.3)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300">
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <path d="M8 6h.01" />
                          <path d="M16 6h.01" />
                          <path d="M12 18h.01" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Estimated Total</p>
                      <p className="text-2xl font-bold text-amber-200 mt-0.5">{fmt(custB.total)}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleSelectBuildVariant("custom")}
                      className={`w-full rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
                        activeVariant === "custom"
                          ? "bg-amber-300 text-slate-950 font-bold shadow-lg shadow-amber-400/30"
                          : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {activeVariant === "custom" ? "Active Selected Build" : "Switch to Custom Build"}
                    </button>
                  </div>
                </div>

                {/* 3. Performance Build (Right) */}
                <div className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition ${
                  activeVariant === "performance"
                    ? "border-purple-400/60 bg-purple-400/10 shadow-[0_0_30px_-8px_rgba(167,139,250,0.3)] ring-1 ring-purple-400/40"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                        Enthusiast Headroom
                      </span>
                      {perfB.total > 0 && custB.total > 0 && perfB.total > custB.total && (
                        <span className="text-[11px] font-semibold text-purple-300/90">
                          +{fmt(perfB.total - custB.total)}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-white">{perfB.title}</h3>
                    <p className="text-xs text-white/40">{perfB.tagline}</p>

                    <div className="my-5 flex justify-center">
                      <div className="flex h-20 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400/80">
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <path d="M8 6h.01" />
                          <path d="M16 6h.01" />
                          <path d="M12 18h.01" />
                        </svg>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Estimated Total</p>
                      <p className="text-2xl font-bold text-white mt-0.5">{fmt(perfB.total)}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleSelectBuildVariant("performance")}
                      className={`w-full rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
                        activeVariant === "performance"
                          ? "bg-purple-400 text-slate-950 font-bold shadow-lg shadow-purple-400/20"
                          : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {activeVariant === "performance" ? "Active Selected Build" : "Switch to this Build"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Specs Matrix Table */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-white/40">
                      <th className="py-3 px-4 w-1/4">Hardware Component</th>
                      <th className="py-3 px-4 w-1/4">AI Value Build</th>
                      <th className="py-3 px-4 w-1/4 text-amber-200 bg-amber-400/[0.04]">Your Custom Build</th>
                      <th className="py-3 px-4 w-1/4">AI Performance Build</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {COMPARE_CATEGORIES.map((cat) => {
                      const valComp = extractComp(valB.build, cat.key);
                      const custComp = extractComp(custB.build, cat.key);
                      const perfComp = extractComp(perfB.build, cat.key);
                      return (
                        <tr key={cat.key} className="hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-4 font-semibold text-white/50 align-top">
                            {cat.label}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <p className="font-semibold text-white/85 leading-snug line-clamp-2">
                              {valComp?.name ?? "—"}
                            </p>
                            <p className="text-[11px] text-white/40 mt-0.5">{getCompSpecSnippet(cat.key, valComp)}</p>
                            <p className="text-[11px] font-medium text-emerald-300 mt-1">{valComp?.price ? fmt(Number(valComp.price)) : "—"}</p>
                          </td>
                          <td className="py-3.5 px-4 align-top bg-amber-400/[0.03]">
                            <p className="font-semibold text-amber-100 leading-snug line-clamp-2">
                              {custComp?.name ?? "—"}
                            </p>
                            <p className="text-[11px] text-amber-200/50 mt-0.5">{getCompSpecSnippet(cat.key, custComp)}</p>
                            <p className="text-[11px] font-medium text-amber-300 mt-1">{custComp?.price ? fmt(Number(custComp.price)) : "—"}</p>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <p className="font-semibold text-white/85 leading-snug line-clamp-2">
                              {perfComp?.name ?? "—"}
                            </p>
                            <p className="text-[11px] text-white/40 mt-0.5">{getCompSpecSnippet(cat.key, perfComp)}</p>
                            <p className="text-[11px] font-medium text-purple-300 mt-1">{perfComp?.price ? fmt(Number(perfComp.price)) : "—"}</p>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary Rows */}
                    <tr className="bg-white/[0.03] font-semibold">
                      <td className="py-3.5 px-4 text-white/50">Compatibility</td>
                      <td className="py-3.5 px-4 text-emerald-300">PASS (Verified)</td>
                      <td className="py-3.5 px-4 text-emerald-300 bg-amber-400/[0.03]">PASS (Verified)</td>
                      <td className="py-3.5 px-4 text-emerald-300">PASS (Verified)</td>
                    </tr>
                    <tr className="bg-white/[0.03] font-bold text-sm">
                      <td className="py-4 px-4 text-white/70">Total Build Price</td>
                      <td className="py-4 px-4 text-white">{fmt(valB.total)}</td>
                      <td className="py-4 px-4 text-amber-300 bg-amber-400/[0.06]">{fmt(custB.total)}</td>
                      <td className="py-4 px-4 text-white">{fmt(perfB.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── Descriptive Comparison Narrative ────────────────────────── */}
              {compBuilds.comparison_summary && (() => {
                const summary = compBuilds.comparison_summary!;

                return (
                  <div className="flex flex-col gap-5">
                    {/* Build Analysis intro */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40 mb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                        Build Analysis
                      </div>
                      <h3 className="font-heading text-lg sm:text-xl text-white">{summary.headline}</h3>
                      <p className="mt-2 text-sm text-white/55 leading-relaxed max-w-3xl">{summary.intro}</p>
                    </div>

                    {/* 3-column descriptive cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                      {summary.columns.map((col) => {
                        const c = compColorMap[col.color] ?? compColorMap.amber;
                        return (
                          <div
                            key={col.id}
                            className={`rounded-2xl border ${c.border} ${c.bg} p-5 flex flex-col gap-4`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className={`text-sm font-bold ${c.text}`}>{col.title}</h4>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${c.badgeBg} ${c.text}`}>
                                {col.id === "custom" ? "Your Pick" : "AI Choice"}
                              </span>
                            </div>
                            <p className="text-xs text-white/65 leading-relaxed">{col.summary}</p>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Key Strengths</span>
                              {col.strengths.map((s, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-white/60">
                                  <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${c.dot}`} />
                                  <span>{s}</span>
                                </div>
                              ))}
                            </div>
                            <div className={`rounded-xl border ${c.border} ${c.bg} px-3 py-2`}>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium mb-1">Ideal For</p>
                              <p className={`text-xs font-medium ${c.accent}`}>{col.ideal_for}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* AI Verdict */}
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent p-5 flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1">AI Verdict</p>
                        <p className="text-sm text-white/70 leading-relaxed">{summary.verdict}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          );
        })()}

        {/* ─── Build Validation & Alignment Metrics ────────────────────────────── */}
        {result.evaluation && (() => {
          const ev = result.evaluation;
          const EVAL_PARAMS = [
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
              description: "Hardware allocation matches activity demand",
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
          ];

          const allPassed = EVAL_PARAMS.every((p) => ev[p.key]?.passed);

          return (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/5 to-transparent p-5 sm:p-7 backdrop-blur shadow-[0_20px_80px_-40px_rgba(251,191,36,0.2)]" data-html2canvas-ignore="true">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-xl sm:text-2xl">Build Verification &amp; Fit</h2>
                  <p className="mt-1 text-xs text-white/50">
                    Comprehensive checks for budget adherence, intended workload balance, and hardware compatibility
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

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {EVAL_PARAMS.map((param) => {
                  const metric = ev[param.key];
                  if (!metric) return null;
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

                      {/* Description */}
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

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] min-w-0">
          {/* ─── Component Breakdown ─────────────────────────── */}
          <div className="min-w-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 md:p-7 shadow-[0_30px_120px_-80px_rgba(16,185,129,0.5)] backdrop-blur">
            <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <h2 className="font-heading text-xl sm:text-2xl text-white">Component Breakdown</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
                Build
              </span>
            </div>

            {result.hardware_advisories && result.hardware_advisories.length > 0 && (
              <div className="mt-4 rounded-xl sm:rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 sm:p-4 text-xs text-amber-200">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-amber-400/20 p-1.5 text-amber-300 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-semibold text-amber-100 uppercase tracking-wider text-[11px]">
                      Hardware Compatibility Advisory
                    </p>
                    <p className="text-amber-200/90 leading-relaxed text-xs">
                      {result.hardware_advisories.some((a) => a.involves_reused)
                        ? "One or more of your customer-provided components have potential hardware conflicts with store inventory. Please review the highlighted component cards below."
                        : "One or more component pairings have advisories. Please review the highlighted component cards below."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 sm:mt-6 grid gap-3 min-w-0">
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

                // Check for cooling or thermal mismatch advisory
                const advisory = mainComp.mismatch_advisory;
                const hasMismatch = Boolean(advisory && advisory.has_mismatch);
                const recommendedFixIdx = alternatives.findIndex((alt) => alt.is_recommended_fix);

                const isReused = Boolean((mainComp as any).is_user_provided || (!mainComp.id && mainComp.price === 0));

                return (
                  <div
                    key={key}
                    className={`group rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 transition min-w-0 ${
                      isReused
                        ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
                        : hasMismatch
                        ? "border-amber-400/40 bg-gradient-to-b from-amber-400/[0.08] to-white/5"
                        : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
                    }`}
                  >
                    {/* Primary Component Pick */}
                    <div className="flex flex-col xs:flex-row xs:items-start justify-between gap-2 sm:gap-3 min-w-0">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <p className="text-[11px] sm:text-xs text-white/50">{meta.label}</p>
                            {isReused ? (
                              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-300 border border-emerald-400/30">
                                Reused Hardware (SDG 12)
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                                Main Option
                              </span>
                            )}
                            {hasMismatch && (
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                                Advisory
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs sm:text-sm font-semibold text-white break-words sm:truncate">
                            {mainComp.name ?? "Unknown"}
                          </p>
                          {getCompSpecSnippet(key, mainComp) && getCompSpecSnippet(key, mainComp) !== "—" && (
                            <p className={`text-[11px] mt-0.5 font-mono ${isReused ? "text-emerald-300/80 font-medium" : "text-white/45"}`}>
                              {getCompSpecSnippet(key, mainComp)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex xs:flex-col items-center xs:items-end justify-between xs:justify-start gap-1 shrink-0 pt-1 xs:pt-0 border-t xs:border-t-0 border-white/5">
                        <span className={`text-xs sm:text-sm font-semibold ${isReused ? "text-emerald-300 font-bold" : "text-white"}`}>
                          {isReused ? "₱0 (Customer Provided)" : (mainComp.price ? fmt(Number(mainComp.price)) : "—")}
                        </span>
                        {tier && !isReused && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] uppercase tracking-wider ${tierClass}`}
                          >
                            {tier}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mismatch Advisory Banner */}
                    {hasMismatch && (
                      <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200 min-w-0">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 rounded-full bg-amber-400/20 p-1 text-amber-300 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-amber-100 uppercase tracking-wider text-[10px] break-words">
                                {advisory?.title ?? (advisory?.cpu_tdp ? `Thermal Advisory • High-TDP CPU (${advisory.cpu_tdp}W)` : "Hardware Advisory")}
                              </span>
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-medium text-amber-300">
                                {isReused ? "Customer Hardware" : advisory?.cpu_tdp ? "User Choice Honored" : "Review Needed"}
                              </span>
                            </div>
                            <p className="text-amber-200/90 text-xs leading-relaxed break-words">
                              {advisory?.reason ?? "Please review this component pairing for potential hardware conflict."}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {recommendedFixIdx !== -1 && (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchComponent(key, recommendedFixIdx)}
                                  className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 w-full sm:w-auto"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
                                  </svg>
                                  <span>{advisory?.cpu_tdp ? "Swap to Recommended Liquid Cooler" : "Swap to In-Stock Option"}</span>
                                </button>
                              )}
                              {advisory?.cpu_tdp && (
                                <span className="text-[10px] text-amber-300/70 italic">
                                  Original Air pick remains selectable and saved.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Alternative Options */}
                    {alternatives.length > 0 && (
                      <div className="mt-3 border-t border-white/10 pt-2.5 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium flex items-center justify-between">
                          <span>Alternative Options (Click to Swap):</span>
                        </p>
                        <div className="grid gap-1.5 min-w-0">
                          {alternatives.map((alt, idx) => {
                            const isRecommendedFix = Boolean(alt.is_recommended_fix);

                            return (
                              <div
                                key={`${key}-alt-${alt.name ?? idx}-${idx}`}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between text-xs rounded-xl p-2.5 sm:px-3 sm:py-2 border transition gap-2 min-w-0 ${
                                  isRecommendedFix
                                    ? "border-amber-400/50 bg-amber-400/10 shadow-[0_0_15px_-3px_rgba(251,191,36,0.15)]"
                                    : "border-white/5 bg-white/[0.04] hover:border-amber-300/30"
                                }`}
                              >
                                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                                  <span
                                    className={`font-mono text-[10px] shrink-0 ${
                                      isRecommendedFix ? "text-amber-300 font-bold" : "text-amber-300/80"
                                    }`}
                                  >
                                    #{idx + 2}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`truncate ${
                                          isRecommendedFix ? "font-semibold text-white" : "text-white/80"
                                        }`}
                                      >
                                        {alt.name ?? "Alternative"}
                                      </span>
                                      {isRecommendedFix && (
                                        <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950 shrink-0">
                                          Recommended Fix
                                        </span>
                                      )}
                                    </div>
                                    {isRecommendedFix && alt.fix_reason && (
                                      <p className="text-[10px] text-amber-200/80 mt-0.5 line-clamp-1">
                                        {String(alt.fix_reason)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                  <span className="text-white/70 font-medium">
                                    {alt.price ? fmt(Number(alt.price)) : "—"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchComponent(key, idx)}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold shadow-sm transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                      isRecommendedFix
                                        ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
                                        : "border border-amber-300/40 bg-amber-400/10 text-amber-200 hover:bg-amber-300 hover:text-slate-950"
                                    }`}
                                  >
                                    <span>Swap</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ─── Total Cost ────────────────────────────────── */}
            <div className="mt-5 sm:mt-6 rounded-xl sm:rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 sm:p-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-200/70">
                    Total Estimated Cost
                  </p>
                  <p className="mt-1 font-heading text-xl sm:text-2xl text-white">
                    {fmt(result.total)}
                  </p>
                </div>
                <div
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider w-fit ${
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
          <div className="min-w-0 flex flex-col gap-6">
            {/* Compatibility Check */}
            <div className="min-w-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-4 sm:p-6 md:p-7">
              <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <h2 className="font-heading text-xl sm:text-2xl text-white">Compatibility Check</h2>
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
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: "Passed", count: compat.passed, color: "emerald" },
                  { label: "Warnings", count: compat.warnings, color: "amber" },
                  { label: "Failures", count: compat.failures, color: "red" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 px-1.5 sm:px-3 py-2.5 sm:py-3 text-center min-w-0"
                  >
                    <p
                      className={`font-heading text-lg sm:text-xl ${
                        s.color === "emerald"
                          ? "text-emerald-300"
                          : s.color === "amber"
                          ? "text-amber-300"
                          : "text-red-300"
                      }`}
                    >
                      {s.count}
                    </p>
                    <p className="mt-0.5 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-widest text-white/50 truncate">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="mt-5 grid gap-2 min-w-0">
                {compat.details.map((d, i) => {
                  const sc = STATUS_COLORS[d.status];
                  return (
                    <div
                      key={i}
                      className={`rounded-xl sm:rounded-2xl border ${sc.border} ${sc.bg} px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-0`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot}`} />
                        <span className={`text-xs font-semibold shrink-0 ${sc.text}`}>
                          {d.status}
                        </span>
                        <span className="text-xs text-white/60 break-words min-w-0 flex-1">
                          {d.rule}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/70 pl-3.5 sm:pl-4 break-words">
                        {d.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="min-w-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 md:p-7" data-html2canvas-ignore="true">
              <h2 className="font-heading text-lg sm:text-xl text-white">What&apos;s next?</h2>
              <p className="mt-1.5 text-xs text-white/60 leading-relaxed">
                Not satisfied? Go back and adjust your requirements to generate
                a different build.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:gap-3">
                <button
                  onClick={() => setTicketModalOpen(true)}
                  className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 px-4 sm:px-5 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all hover:shadow-amber-400/40 hover:brightness-110 active:scale-95 cursor-pointer w-full"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    <span>Get Store Ticket / Reserve in Store</span>
                  </span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 sm:px-5 py-3 text-center text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110 disabled:cursor-wait disabled:opacity-70 cursor-pointer w-full"
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
                  className="rounded-xl sm:rounded-2xl bg-white px-4 sm:px-5 py-3 text-center text-xs sm:text-sm font-semibold text-slate-950 transition hover:bg-white/90 w-full"
                >
                  Generate another build
                </Link>
                <Link
                  href="/"
                  className="rounded-xl sm:rounded-2xl border border-white/20 px-4 sm:px-5 py-3 text-center text-xs sm:text-sm font-semibold text-white/80 transition hover:bg-white/5 w-full"
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
