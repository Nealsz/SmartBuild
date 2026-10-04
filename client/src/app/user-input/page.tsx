"use client";

import { useEffect, useRef, useState } from "react";
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

const STEPS = ["budget", "primary", "secondary", "resolution"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  budget: "Budget",
  primary: "Primary Use",
  secondary: "Secondary Use",
  resolution: "Display",
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
  const [secondaryActivity, setSecondaryActivity] = useState("");
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

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/generate-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          min_budget: parseBudget(minBudget),
          max_budget: parseBudget(maxBudget),
          primary_activity: primaryActivity,
          secondary_activity: secondaryActivity || "",
          resolution_target: resolutionTarget,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Server error (${res.status})`);
      }

      const result = await res.json();
      sessionStorage.setItem("smartbuild_result", JSON.stringify(result));
      sessionStorage.setItem(
        "smartbuild_input",
        JSON.stringify({
          min_budget: parseBudget(minBudget),
          max_budget: parseBudget(maxBudget),
          primary_activity: primaryActivity,
          secondary_activity: secondaryActivity || null,
          resolution_target: resolutionTarget,
        })
      );
      router.push("/build-result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

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
            {STEPS.map((s, i) => (
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
            Step {stepIndex + 1} of {STEPS.length}
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
                    if (primaryActivity) transitionTo("secondary");
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
                  onClick={() => transitionTo("primary")}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <button
                  type="button"
                  id="secondary-next-btn"
                  onClick={() => transitionTo("resolution")}
                  className="flex items-center gap-2 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-200 transition"
                >
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: RESOLUTION & REFRESH RATE ───────────── */}
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
                  id="generate-build-btn"
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition shadow-lg ${
                    !loading
                      ? "bg-amber-300 text-slate-950 shadow-amber-400/30 hover:bg-amber-200 cursor-pointer"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Build
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "AI-Powered",
              body: "Random Forest model predicts optimal component tiers based on your exact requirements.",
              accent: "amber",
            },
            {
              title: "Compatibility First",
              body: "Every build is validated for socket match, DDR gen, PSU headroom, and case clearance.",
              accent: "blue",
            },
            {
              title: "Budget-Aware",
              body: "Component allocation shifts dynamically to honor your specific usage priorities.",
              accent: "emerald",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    card.accent === "amber"
                      ? "bg-amber-300"
                      : card.accent === "blue"
                      ? "bg-blue-300"
                      : "bg-emerald-300"
                  }`}
                />
                <h3 className="font-heading text-base">{card.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/60">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
