"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ActivityDetail = {
  value: string;
  description: string;
  focus: string;
};

const ACTIVITIES: ActivityDetail[] = [
  {
    value: "Gaming",
    description: "Esports, AAA titles, high FPS & ray tracing",
    focus: "High GPU compute & VRAM",
  },
  {
    value: "Video Editing",
    description: "4K/1080p timeline playback, rendering & export",
    focus: "Multi-core CPU & 32GB+ RAM",
  },
  {
    value: "Photo / Graphic Design",
    description: "Photoshop, Illustrator & high-res vector canvas",
    focus: "Fast single-core CPU & RAM",
  },
  {
    value: "3D Modeling or Animation",
    description: "Blender, Maya, CAD & real-time 3D viewports",
    focus: "Heavy GPU compute & CPU threads",
  },
  {
    value: "Programming or Development",
    description: "Compilers, Docker containers, IDEs & emulators",
    focus: "Fast CPU, 32GB RAM & NVMe SSD",
  },
  {
    value: "Streaming / Recording",
    description: "Live broadcasting while capturing games or apps",
    focus: "Multi-core CPU & GPU encoder",
  },
  {
    value: "Music Production",
    description: "DAWs, virtual instruments & multi-track mixing",
    focus: "Low-latency CPU & fast storage",
  },
  {
    value: "Simulations / Data Analysis",
    description: "Scientific computing, data science & analytics",
    focus: "Max RAM capacity & CPU cores",
  },
  {
    value: "Documents / Office Work",
    description: "Spreadsheets, multi-tasking & administrative apps",
    focus: "Responsive CPU & fast NVMe SSD",
  },
  {
    value: "Browsing & Streaming",
    description: "Web research, 4K media consumption & daily use",
    focus: "Balanced entry hardware",
  },
];

const ACTIVITY_OPTIONS = ACTIVITIES.map((a) => a.value);

type SubcategoryDetail = {
  description: string;
  hardwareFocus: string;
};

const ACTIVITY_SUBCATEGORIES: Record<string, Record<"Light" | "Standard" | "Heavy", SubcategoryDetail>> = {
  "Gaming": {
    "Light": {
      description: "Valorant, LoL, CS2, indie titles",
      hardwareFocus: "6-core CPU, entry GPU, 16GB RAM, 1080p 60fps+",
    },
    "Standard": {
      description: "GTA V, Apex Legends, Helldivers 2",
      hardwareFocus: "6-8 core, mid GPU, 16GB RAM, 1080p-1440p 60-144fps",
    },
    "Heavy": {
      description: "Cyberpunk 2077, Alan Wake 2, Black Myth Wukong, modded",
      hardwareFocus: "8-core+, high-end GPU, 32GB RAM, 1440p-4K w/ ray tracing",
    },
  },
  "Browsing & Streaming": {
    "Light": {
      description: "Basic web, email, SD/HD video",
      hardwareFocus: "dual/quad-core, 8GB RAM",
    },
    "Standard": {
      description: "Many tabs, 4K streaming, light multitasking",
      hardwareFocus: "quad-core+, 8-16GB RAM",
    },
    "Heavy": {
      description: "Heavy multitasking + 4K/HDR + recording",
      hardwareFocus: "6-core+, 16GB RAM",
    },
  },
  "Documents / Office Work": {
    "Light": {
      description: "Word/Excel/browser",
      hardwareFocus: "dual/quad-core, 8GB RAM",
    },
    "Standard": {
      description: "Heavy spreadsheets/macros, video calls",
      hardwareFocus: "quad-core+, 16GB RAM",
    },
    "Heavy": {
      description: "Large datasets, Power BI/VBA, multi-monitor + calls",
      hardwareFocus: "6-core+, 32GB RAM",
    },
  },
  "Video Editing": {
    "Light": {
      description: "1080p vlogs/shorts (CapCut, basic Premiere)",
      hardwareFocus: "6-core, 16GB RAM, entry GPU w/ NVENC",
    },
    "Standard": {
      description: "1080p-4K multi-track, color grading (Premiere/Resolve)",
      hardwareFocus: "8-core, 32GB RAM, 8GB+ VRAM",
    },
    "Heavy": {
      description: "4K-8K RAW, VFX/compositing (Resolve Studio/Fusion)",
      hardwareFocus: "12-16 core, 64GB RAM, 16GB+ VRAM",
    },
  },
  "Photo / Graphic Design": {
    "Light": {
      description: "Basic retouching, small exports",
      hardwareFocus: "quad-core, 16GB RAM",
    },
    "Standard": {
      description: "Large PSDs, multi-app workflows",
      hardwareFocus: "6-8 core, 32GB RAM, mid GPU",
    },
    "Heavy": {
      description: "Huge composites, print production",
      hardwareFocus: "8-core+, 64GB RAM",
    },
  },
  "3D Modeling or Animation": {
    "Light": {
      description: "Blender/SketchUp hobbyist",
      hardwareFocus: "6-core, 16GB RAM, entry GPU",
    },
    "Standard": {
      description: "Maya/3ds Max professional + mid rendering",
      hardwareFocus: "8-core, 32GB RAM, 12GB+ VRAM",
    },
    "Heavy": {
      description: "Film-quality rendering, sims (Houdini/UE cinematics)",
      hardwareFocus: "16-core+, 64-128GB RAM, 24GB+ VRAM",
    },
  },
  "Music Production": {
    "Light": {
      description: "Simple DAW, few tracks",
      hardwareFocus: "quad-core, 16GB RAM",
    },
    "Standard": {
      description: "Multi-track + moderate VSTs (Ableton/FL standard)",
      hardwareFocus: "6-8 core, 32GB RAM",
    },
    "Heavy": {
      description: "Orchestral libraries, heavy plugin stacking",
      hardwareFocus: "8-12 core, 64GB RAM, fast NVMe",
    },
  },
  "Programming or Development": {
    "Light": {
      description: "Scripting, basic web dev",
      hardwareFocus: "quad-core, 16GB RAM",
    },
    "Standard": {
      description: "Full-stack + Docker + multiple IDEs",
      hardwareFocus: "6-8 core, 32GB RAM",
    },
    "Heavy": {
      description: "Large builds, multiple VMs, local ML training",
      hardwareFocus: "12-core+, 64GB RAM, GPU for CUDA",
    },
  },
  "Streaming / Recording": {
    "Light": {
      description: "Occasional 720-1080p single-app capture",
      hardwareFocus: "6-core, 16GB RAM, GPU w/ NVENC",
    },
    "Standard": {
      description: "Regular 1080p stream + overlays while gaming",
      hardwareFocus: "8-core, 32GB RAM, mid-high GPU",
    },
    "Heavy": {
      description: "Multi-platform 1440-4K + heavy game + filters",
      hardwareFocus: "12-core+, 32-64GB RAM, high-end GPU",
    },
  },
  "Simulations / Data Analysis": {
    "Light": {
      description: "Small datasets, basic scripts",
      hardwareFocus: "quad-core, 16GB RAM",
    },
    "Standard": {
      description: "Pandas/R workflows, moderate ML",
      hardwareFocus: "8-core, 32GB RAM",
    },
    "Heavy": {
      description: "CFD/FEA, big data, deep learning training",
      hardwareFocus: "16-core+, 64-128GB RAM, CUDA GPU",
    },
  },
};

const COOLING_OPTIONS = [
  {
    value: "Auto",
    label: "Auto (Recommended)",
    description: "Intelligently decides based on CPU TDP. Uses Air cooling for cool CPUs and Liquid AIO for high-TDP (≥125W) chips.",
    badge: "Smart Auto",
  },
  {
    value: "Air",
    label: "Air Cooling",
    description: "Traditional heatsink & fan. Reliable, quiet, low maintenance, zero pump risk, and high longevity.",
    badge: "Air Cooler",
  },
  {
    value: "Liquid / AIO",
    label: "Liquid / AIO",
    description: "Closed-loop liquid radiator. Superior sustained thermals, high boost clock headroom & sleek aesthetics.",
    badge: "Liquid AIO",
  },
];

const RESOLUTION_OPTIONS = [
  {
    value: "1080p 60Hz (FHD Standard)",
    label: "1080p 60Hz",
    description: "Standard Full HD — casual use & office work",
  },
  {
    value: "1080p 144Hz+ (FHD High FPS)",
    label: "1080p 144Hz+",
    description: "High-FPS Full HD — competitive gaming",
  },
  {
    value: "1440p 60-144Hz (QHD Standard)",
    label: "1440p 60–144Hz",
    description: "Quad HD — sharp visuals & smooth gameplay",
  },
  {
    value: "1440p 165Hz+ (QHD High FPS)",
    label: "1440p 165Hz+",
    description: "QHD High FPS — enthusiast 1440p gaming",
  },
  {
    value: "4K 60Hz+ (UHD Ultra)",
    label: "4K 60Hz+",
    description: "Ultra HD — 4K productivity & content creation",
  },
];

const STEPS = [
  "budget",
  "primary",
  "primary-sub",
  "secondary",
  "secondary-sub",
  "cooling",
  "resolution",
] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  budget:        "Budget",
  primary:       "Primary",
  "primary-sub": "Sub-Category",
  secondary:     "Secondary",
  "secondary-sub":"Sub-Category",
  cooling:       "Cooling",
  resolution:    "Display",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function UserInputPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("budget");
  const [animState, setAnimState] = useState<"visible" | "exit" | "enter">("visible");

  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [baseMaxBudget, setBaseMaxBudget] = useState<number | null>(null);
  const [baseFormattedBudget, setBaseFormattedBudget] = useState<string>("");
  const [primaryActivity, setPrimaryActivity] = useState("");
  const [primarySubcategory, setPrimarySubcategory] = useState<"Light" | "Standard" | "Heavy">("Standard");
  const [secondaryActivity, setSecondaryActivity] = useState("");
  const [secondarySubcategory, setSecondarySubcategory] = useState<"Light" | "Standard" | "Heavy">("Standard");
  const [coolingPreference, setCoolingPreference] = useState("Auto");
  const [resolutionTarget, setResolutionTarget] = useState("1080p 144Hz+ (FHD High FPS)");

  const [budgetError, setBudgetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/min-compatible-budget`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.min_budget) {
          setBaseMaxBudget(data.min_budget);
          setBaseFormattedBudget(
            data.formatted_min_budget ?? `₱${data.min_budget.toLocaleString()}`
          );
        }
      })
      .catch(() => {
        setBaseMaxBudget(14037);
        setBaseFormattedBudget("₱14,037");
      });
  }, []);

  // Restore state when returning from guided-builder
  useEffect(() => {
    const returning = sessionStorage.getItem("smartbuild_returning");
    if (returning === "true") {
      sessionStorage.removeItem("smartbuild_returning");
      const stored = sessionStorage.getItem("smartbuild_input");
      if (stored) {
        try {
          const saved = JSON.parse(stored);
          if (saved.min_budget) setMinBudget(String(saved.min_budget));
          if (saved.max_budget) setMaxBudget(String(saved.max_budget));
          if (saved.primary_activity) setPrimaryActivity(saved.primary_activity);
          if (saved.primary_subcategory) setPrimarySubcategory(saved.primary_subcategory);
          if (saved.secondary_activity) setSecondaryActivity(saved.secondary_activity ?? "");
          if (saved.secondary_subcategory) setSecondarySubcategory(saved.secondary_subcategory ?? "Standard");
          if (saved.cooling_preference) setCoolingPreference(saved.cooling_preference);
          if (saved.resolution_target) setResolutionTarget(saved.resolution_target);
          // Jump straight to the last step
          setStep("resolution");
        } catch {
          // silently ignore parse error
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus min input when on budget step
  useEffect(() => {
    if (step === "budget") setTimeout(() => minRef.current?.focus(), 420);
  }, [step]);

  const currencyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  const parseBudget = (val: string) =>
    Number.parseInt(val.replace(/,/g, ""), 10) || 0;

  const transitionTo = (next: Step) => {
    setAnimState("exit");
    setTimeout(() => {
      setStep(next);
      setAnimState("enter");
      setTimeout(() => setAnimState("visible"), 400);
    }, 350);
  };

  const validateBudget = (): boolean => {
    const min = parseBudget(minBudget);
    const max = parseBudget(maxBudget);
    if (min <= 0) { setBudgetError("Please enter a minimum budget."); return false; }
    if (max <= 0) { setBudgetError("Please enter a maximum budget."); return false; }
    if (max < min) { setBudgetError("Maximum must be ≥ minimum."); return false; }
    if (baseMaxBudget !== null && max < baseMaxBudget) {
      setBudgetError(`Budget is below the minimum for a compatible build (${baseFormattedBudget}).`);
      return false;
    }
    setBudgetError("");
    return true;
  };

  const handleBudgetProceed = () => {
    if (!validateBudget()) return;
    transitionTo("primary");
  };

  const buildInputPayload = () => ({
    min_budget: parseBudget(minBudget),
    max_budget: parseBudget(maxBudget),
    primary_activity: primaryActivity,
    secondary_activity: secondaryActivity || null,
    primary_subcategory: primarySubcategory,
    secondary_subcategory: secondaryActivity ? secondarySubcategory : "Standard",
    cooling_preference: coolingPreference,
    resolution_target: resolutionTarget,
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = buildInputPayload();
      const res = await fetch(`${API_BASE}/generate-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          secondary_activity: payload.secondary_activity || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Server error (${res.status})`);
      }

      const result = await res.json();
      sessionStorage.setItem("smartbuild_result", JSON.stringify(result));
      sessionStorage.setItem("smartbuild_input", JSON.stringify(payload));
      router.push("/build-result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  const handleCustomBuild = () => {
    sessionStorage.setItem("smartbuild_input", JSON.stringify(buildInputPayload()));
    router.push("/guided-builder");
  };

  const activeSteps = useMemo<Step[]>(() => {
    return [
      "budget",
      "primary",
      "primary-sub",
      "secondary",
      ...(secondaryActivity ? (["secondary-sub"] as const) : []),
      "cooling",
      "resolution",
    ];
  }, [secondaryActivity]);

  const stepIndex = Math.max(0, activeSteps.indexOf(step));
  const progress = ((stepIndex + 1) / activeSteps.length) * 100;

  const slideClass =
    animState === "exit"
      ? "opacity-0 translate-y-4 pointer-events-none"
      : animState === "enter"
      ? "opacity-0 -translate-y-4 pointer-events-none"
      : "opacity-100 translate-y-0";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(251,191,36,0.08),transparent_40%),linear-gradient(240deg,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 pb-24 pt-12">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-white/50 transition hover:text-white/80 w-fit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Home
          </Link>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-amber-200/80">
            <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
            SmartBuild AI Recommendation
          </div>
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
            Tell us about your ideal PC.
          </h1>
        </header>

        {/* Progress */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between">
            {activeSteps.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full transition-all duration-500 ${
                    i < stepIndex
                      ? "bg-amber-300 scale-100"
                      : i === stepIndex
                      ? "bg-amber-300 scale-125 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                      : "bg-white/20"
                  }`}
                />
                <span
                  className={`text-[10px] transition-all duration-300 ${
                    i <= stepIndex ? "text-amber-200/80" : "text-white/25"
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
            ))}
          </div>
          <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
              style={{ width: `${progress}%`, transition: "width 700ms cubic-bezier(0.4,0,0.2,1)" }}
            />
          </div>
          <p className="text-right text-xs text-white/30">
            Step {stepIndex + 1} of {activeSteps.length}
          </p>
        </div>

        {/* Slide Card */}
        <div
          className={`rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_30px_120px_-80px_rgba(251,191,36,0.4)] backdrop-blur ${slideClass}`}
          style={{ transition: "opacity 350ms ease, transform 350ms ease" }}
        >
          {/* ── STEP 1: BUDGET ─────────────────────────────────── */}
          {step === "budget" && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-heading text-2xl">What&apos;s your budget?</h2>
                <p className="mt-1 text-sm text-white/50">
                  Set the minimum and maximum amount you&apos;re willing to spend. The AI will maximize performance within this range.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-200/70 uppercase tracking-widest">Minimum</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/40">₱</span>
                    <input
                      ref={minRef}
                      id="budget-min"
                      type="text"
                      inputMode="numeric"
                      value={minBudget}
                      onChange={(e) => { setMinBudget(e.target.value); setBudgetError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") maxRef.current?.focus(); }}
                      placeholder="e.g. 20,000"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 pl-8 text-sm text-white placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-200/70 uppercase tracking-widest">Maximum</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/40">₱</span>
                    <input
                      ref={maxRef}
                      id="budget-max"
                      type="text"
                      inputMode="numeric"
                      value={maxBudget}
                      onChange={(e) => { setMaxBudget(e.target.value); setBudgetError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleBudgetProceed(); }}
                      placeholder="e.g. 50,000"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 pl-8 text-sm text-white placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200">
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {baseMaxBudget !== null ? (
                    <span>
                      Minimum compatible build: <strong className="font-semibold text-white">{baseFormattedBudget}</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Computing minimum compatible build…
                      <svg className="h-3 w-3 animate-spin text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={baseMaxBudget === null}
                  onClick={() => { if (baseMaxBudget !== null) { setMaxBudget(baseMaxBudget.toString()); setBudgetError(""); } }}
                  className={`w-fit rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
                    baseMaxBudget !== null
                      ? "border-amber-400/40 bg-amber-400/20 text-amber-100 hover:bg-amber-400/40 hover:text-white cursor-pointer"
                      : "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                >
                  Set as Max
                </button>
              </div>

              {parseBudget(minBudget) > 0 && parseBudget(maxBudget) > 0 && (
                <p className="text-xs text-white/40">
                  Range: {currencyFormatter.format(parseBudget(minBudget))} – {currencyFormatter.format(parseBudget(maxBudget))}
                </p>
              )}

              {budgetError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {budgetError}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-white/30">
                  Press{" "}
                  <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
                  to continue
                </p>
                <button
                  type="button"
                  id="budget-next-btn"
                  onClick={handleBudgetProceed}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: PRIMARY ACTIVITY ──────────────────────── */}
          {step === "primary" && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-heading text-2xl">What will you mainly use it for?</h2>
                <p className="mt-1 text-sm text-white/50">
                  Select the primary purpose. The AI weights hardware differently based on this choice.
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {ACTIVITIES.map((act) => {
                  const isSelected = primaryActivity === act.value;
                  return (
                    <button
                      key={act.value}
                      type="button"
                      id={`primary-${act.value.replace(/[\s\/&]/g, "-").toLowerCase()}`}
                      onClick={() => {
                        setPrimaryActivity(act.value);
                        if (secondaryActivity === act.value) setSecondaryActivity("");
                      }}
                      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-amber-400/60 bg-amber-400/15 text-white shadow-[0_0_20px_-8px_rgba(251,191,36,0.3)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-semibold text-white truncate">{act.value}</span>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 transition ${
                            isSelected ? "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-white/20"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {act.description}
                      </p>
                      <div className="mt-auto pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-white/40 font-mono">Priority:</span>
                        <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200/90 font-medium">
                          {act.focus}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => transitionTo("budget")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="primary-next-btn"
                  disabled={!primaryActivity}
                  onClick={() => {
                    if (primaryActivity) transitionTo("primary-sub");
                  }}
                  className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                    primaryActivity
                      ? "bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 cursor-pointer"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2B: PRIMARY SUB-CATEGORY ─────────────────── */}
          {step === "primary-sub" && (
            <div className="grid gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-200 font-medium">
                    {primaryActivity}
                  </span>
                  <span className="text-xs text-white/40">Primary Workload</span>
                </div>
                <h2 className="font-heading text-2xl">What is your workload intensity?</h2>
                <p className="mt-1 text-sm text-white/50">
                  Select your anticipated usage level. The AI shifts component weighting and tier priority accordingly.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {(["Light", "Standard", "Heavy"] as const).map((tier) => {
                  const isTierSelected = primarySubcategory === tier;
                  const subInfo = ACTIVITY_SUBCATEGORIES[primaryActivity]?.[tier];
                  return (
                    <button
                      key={tier}
                      type="button"
                      id={`primary-sub-${tier.toLowerCase()}`}
                      onClick={() => setPrimarySubcategory(tier)}
                      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                        isTierSelected
                          ? "border-amber-400/60 bg-amber-400/15 text-white shadow-[0_0_20px_-8px_rgba(251,191,36,0.3)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-white">{tier}</span>
                        {tier === "Standard" && (
                          <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed min-h-[48px]">
                        {subInfo?.description ?? "Standard general load"}
                      </p>
                      <div className="mt-auto pt-2 border-t border-white/5">
                        <span className="text-[10px] text-white/40 font-mono block">Hardware Focus:</span>
                        <p className="text-[11px] text-amber-200/90 font-medium mt-0.5">
                          {subInfo?.hardwareFocus ?? "Balanced spec"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => transitionTo("primary")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="primary-sub-next-btn"
                  onClick={() => transitionTo("secondary")}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: SECONDARY ACTIVITY ───────────────────── */}
          {step === "secondary" && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-heading text-2xl">
                  Any secondary use?{" "}
                  <span className="text-white/30 font-normal text-xl">(Optional)</span>
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  If you plan to use the PC for something else too, select it here. This helps balance the build.
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <button
                  type="button"
                  id="secondary-none"
                  onClick={() => setSecondaryActivity("")}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition sm:col-span-2 ${
                    secondaryActivity === ""
                      ? "border-blue-400/60 bg-blue-400/15 text-white shadow-[0_0_20px_-8px_rgba(59,130,246,0.3)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-white">None (Dedicated Build)</span>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 transition ${
                        secondaryActivity === "" ? "bg-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-white/20"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-white/50">
                    Dedicate 100% of the hardware budget and tier weighting purely to your primary activity.
                  </p>
                </button>
                {ACTIVITIES.filter((a) => a.value !== primaryActivity).map((act) => {
                  const isSelected = secondaryActivity === act.value;
                  return (
                    <button
                      key={act.value}
                      type="button"
                      id={`secondary-${act.value.replace(/[\s\/&]/g, "-").toLowerCase()}`}
                      onClick={() => setSecondaryActivity(act.value)}
                      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-blue-400/60 bg-blue-400/15 text-white shadow-[0_0_20px_-8px_rgba(59,130,246,0.3)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-semibold text-white truncate">{act.value}</span>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 transition ${
                            isSelected ? "bg-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-white/20"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {act.description}
                      </p>
                      <div className="mt-auto pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-white/40 font-mono">Priority:</span>
                        <span className="rounded-md border border-blue-400/25 bg-blue-400/10 px-2 py-0.5 text-[10px] text-blue-200/90 font-medium">
                          {act.focus}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => transitionTo("primary-sub")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="secondary-next-btn"
                  onClick={() => {
                    if (secondaryActivity) {
                      transitionTo("secondary-sub");
                    } else {
                      transitionTo("cooling");
                    }
                  }}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3B: SECONDARY SUB-CATEGORY ───────────────── */}
          {step === "secondary-sub" && (
            <div className="grid gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-md border border-blue-400/30 bg-blue-400/10 px-2.5 py-0.5 text-xs text-blue-200 font-medium">
                    {secondaryActivity}
                  </span>
                  <span className="text-xs text-white/40">Secondary Workload</span>
                </div>
                <h2 className="font-heading text-2xl">What is your secondary intensity?</h2>
                <p className="mt-1 text-sm text-white/50">
                  Select your expected load level for {secondaryActivity.toLowerCase()}. The recommender blends this at 30% weight alongside your primary workload.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {(["Light", "Standard", "Heavy"] as const).map((tier) => {
                  const isTierSelected = secondarySubcategory === tier;
                  const subInfo = ACTIVITY_SUBCATEGORIES[secondaryActivity]?.[tier];
                  return (
                    <button
                      key={tier}
                      type="button"
                      id={`secondary-sub-${tier.toLowerCase()}`}
                      onClick={() => setSecondarySubcategory(tier)}
                      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                        isTierSelected
                          ? "border-blue-400/60 bg-blue-400/15 text-white shadow-[0_0_20px_-8px_rgba(59,130,246,0.3)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-white">{tier}</span>
                        {tier === "Standard" && (
                          <span className="rounded bg-blue-400/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed min-h-[48px]">
                        {subInfo?.description ?? "Standard general load"}
                      </p>
                      <div className="mt-auto pt-2 border-t border-white/5">
                        <span className="text-[10px] text-white/40 font-mono block">Hardware Focus:</span>
                        <p className="text-[11px] text-blue-200/90 font-medium mt-0.5">
                          {subInfo?.hardwareFocus ?? "Balanced spec"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => transitionTo("secondary")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="secondary-sub-next-btn"
                  onClick={() => transitionTo("cooling")}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: COOLING PREFERENCE ─────────────────────── */}
          {step === "cooling" && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-heading text-2xl">Preferred CPU Cooling Type</h2>
                <p className="mt-1 text-sm text-white/50">
                  Select your thermal solution. The AI will prioritize your choice while ensuring sustained processor performance and case clearance.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {COOLING_OPTIONS.map((opt) => {
                  const isSelected = coolingPreference === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      id={`cooling-${opt.value.toLowerCase().replace(/[\s\/]/g, "-")}`}
                      onClick={() => setCoolingPreference(opt.value)}
                      className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:p-5 text-left transition min-h-[145px] ${
                        isSelected
                          ? "border-amber-400/60 bg-amber-400/15 text-white shadow-[0_0_20px_-8px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/30"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white text-sm sm:text-base">{opt.label}</span>
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 transition ${
                              isSelected
                                ? "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                                : "bg-white/20"
                            }`}
                          />
                        </div>
                        <p className="mt-2 text-xs text-white/50 leading-relaxed">{opt.description}</p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-white/40 font-mono">Thermal Profile:</span>
                        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200 font-medium">
                          {opt.badge}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => transitionTo(secondaryActivity ? "secondary-sub" : "secondary")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="cooling-next-btn"
                  onClick={() => transitionTo("resolution")}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: RESOLUTION & REFRESH RATE ───────────── */}
          {step === "resolution" && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-heading text-2xl">What screen are you targeting?</h2>
                <p className="mt-1 text-sm text-white/50">
                  Select your monitor resolution &amp; refresh rate. The AI uses this to scale GPU VRAM requirements and compute throughput.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`resolution-${opt.value.replace(/[\s+().]/g, "-").toLowerCase()}`}
                    onClick={() => setResolutionTarget(opt.value)}
                    className={`flex flex-col gap-1.5 rounded-2xl border px-4 py-4 text-left transition ${
                      resolutionTarget === opt.value
                        ? "border-violet-400/60 bg-violet-400/15 text-white shadow-[0_0_20px_-8px_rgba(167,139,250,0.4)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-white/50">{opt.description}</span>
                  </button>
                ))}
              </div>
              {error && (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => transitionTo("cooling")}
                    className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      id="generate-build-btn"
                      type="button"
                      disabled={loading}
                      onClick={handleSubmit}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                          Auto-building...
                        </>
                      ) : (
                        "Quick 1-Click Build"
                      )}
                    </button>
                    <button
                      id="custom-build-btn"
                      type="button"
                      onClick={handleCustomBuild}
                      className="flex items-center gap-2 rounded-full bg-amber-300 px-7 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-200 cursor-pointer"
                    >
                      Start Component Selection
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>
                <p className="text-right text-[10px] text-white/30">Select from 3 tailored options per component category with specs and difference comparisons</p>
              </div>
            </div>
          )}
        </div>


      </main>
    </div>
  );
}
