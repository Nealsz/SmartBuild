"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CATEGORY_ORDER = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "storage",
  "psu",
  "case",
  "cpu_cooler",
  "case_fan",
] as const;

type Category = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  cpu: "CPU",
  motherboard: "Motherboard",
  ram: "RAM",
  gpu: "GPU",
  storage: "Storage",
  psu: "Power Supply",
  case: "Case",
  cpu_cooler: "CPU Cooler",
  case_fan: "Case Fans",
};

type ComponentOption = {
  role: "Value Option" | "AI Recommended" | "High Performance";
  badge: string;
  component: Record<string, unknown>;
  specs: Record<string, string>;
  price: number;
};

type CategoryResponse = {
  category: string;
  category_title: string;
  category_icon: string;
  category_description: string;
  step_number: number;
  total_steps: number;
  options: ComponentOption[];
  difference_analysis: {
    summary: string;
    points: string[];
  };
  spent_so_far: number;
  remaining_budget: number;
  target_budget_min: number;
  target_budget_max: number;
};

type UserInput = {
  min_budget: number;
  max_budget: number;
  primary_activity: string;
  secondary_activity: string | null;
  primary_subcategory: string;
  secondary_subcategory: string;
  cooling_preference: string;
  resolution_target: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function fmt(v: number): string {
  return currencyFormatter.format(v);
}

export default function GuidedBuilderPage() {
  const router = useRouter();

  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [categoryData, setCategoryData] = useState<CategoryResponse | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedOption, setSelectedOption] = useState<ComponentOption | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showDiff, setShowDiff] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  /* Load user input from session */
  useEffect(() => {
    const stored = sessionStorage.getItem("smartbuild_input");
    if (!stored) {
      router.push("/user-input");
      return;
    }
    try {
      setUserInput(JSON.parse(stored));
    } catch {
      router.push("/user-input");
    }
  }, [router]);

  /* Fetch options for current category */
  const fetchCategory = useCallback(
    async (step: number, selected: Record<string, Record<string, unknown>>) => {
      if (!userInput) return;
      setLoading(true);
      setError("");
      setSelectedOption(null);
      setShowDiff(false);

      try {
        const catKey = CATEGORY_ORDER[step];
        const res = await fetch(`${API_BASE}/builder/category-options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...userInput,
            category: catKey,
            selected_components: selected,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.detail ?? `Server error (${res.status})`);
        }

        const data: CategoryResponse = await res.json();
        setCategoryData(data);

        // Pre-select if already chosen previously
        if (selected[catKey]) {
          const prevChosen = data.options.find(
            (opt) => opt.component.name === selected[catKey].name
          );
          if (prevChosen) setSelectedOption(prevChosen);
        }

        setTimeout(() => {
          containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [userInput]
  );

  /* Initial fetch once input is ready */
  useEffect(() => {
    if (userInput && currentStep === 0 && !categoryData) {
      fetchCategory(0, {});
    }
  }, [userInput, currentStep, categoryData, fetchCategory]);

  /* Confirm selection and advance */
  const handleConfirmSelection = async () => {
    if (!selectedOption) return;

    const currentCatKey = CATEGORY_ORDER[currentStep];
    const newSelected = {
      ...selectedComponents,
      [currentCatKey]: selectedOption.component,
    };
    setSelectedComponents(newSelected);

    const nextStep = currentStep + 1;
    if (nextStep >= CATEGORY_ORDER.length) {
      await finalizeBuild(newSelected);
    } else {
      setCurrentStep(nextStep);
      fetchCategory(nextStep, newSelected);
    }
  };

  /* Step back */
  const handlePrevious = () => {
    if (currentStep === 0) {
      // Save current preferences and flag the return so user-input restores state
      sessionStorage.setItem("smartbuild_returning", "true");
      router.push("/user-input");
    } else {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      fetchCategory(prevStep, selectedComponents);
    }
  };

  /* Finalize build */
  const finalizeBuild = async (allSelected: Record<string, Record<string, unknown>>) => {
    if (!userInput) return;
    setFinalizing(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/builder/finalize-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userInput,
          selected_components: allSelected,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail ?? `Finalize error (${res.status})`);
      }

      const result = await res.json();
      sessionStorage.setItem("smartbuild_result", JSON.stringify(result));
      router.push("/build-result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Finalization failed.");
      setFinalizing(false);
    }
  };

  if (!userInput) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
      </div>
    );
  }

  const currentCat = CATEGORY_ORDER[currentStep];
  const progressPct = ((currentStep + 1) / CATEGORY_ORDER.length) * 100;
  const spent = categoryData?.spent_so_far ?? 0;
  const maxBud = categoryData?.target_budget_max ?? userInput.max_budget;
  const minBud = categoryData?.target_budget_min ?? userInput.min_budget;
  const remaining = categoryData?.remaining_budget ?? (maxBud - spent);

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Background effects (matching system UI/UX) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(251,191,36,0.08),transparent_40%),linear-gradient(240deg,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-24 pt-12">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("smartbuild_returning", "true");
              router.push("/user-input");
            }}
            className="flex items-center gap-2 text-xs text-white/50 transition hover:text-white/80 w-fit cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Preferences
          </button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-amber-200/80">
            <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
            SmartBuild Component Selector
          </div>
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
            Choose your {categoryData?.category_title ?? "Component"}.
          </h1>
          <p className="text-sm text-white/60">
            Select 1 of 3 compatible options tailored to your workload. Compatibility is validated at every step.
          </p>
        </header>

        {/* Progress Stepper with Step Numbers */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center w-full">
            {CATEGORY_ORDER.map((cat, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={cat} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                      isCompleted
                        ? "bg-amber-300 text-slate-950 font-bold"
                        : isCurrent
                        ? "border border-amber-300 bg-amber-400/20 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                        : "border border-white/10 bg-white/5 text-white/30"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] hidden sm:block tracking-tight text-center transition-all ${
                      isCurrent
                        ? "text-amber-200 font-semibold"
                        : isCompleted
                        ? "text-white/60"
                        : "text-white/25"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
              style={{
                width: `${progressPct}%`,
                transition: "width 500ms cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-white/40">
            <span>
              Current: <strong className="text-white/70">{CATEGORY_LABELS[currentCat]}</strong>
            </span>
            <span>
              Step {currentStep + 1} of {CATEGORY_ORDER.length}
            </span>
          </div>
        </div>

        {/* Budget Tracker Box */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Budget Allocation</span>
            <span className="font-semibold text-white">
              {fmt(spent)} <span className="text-white/40">/ {fmt(maxBud)}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-500"
              style={{
                width: `${Math.min(100, (spent / maxBud) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/40">
            <span>Target Range: {fmt(minBud)} – {fmt(maxBud)}</span>
            <span>Remaining: {fmt(remaining)}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Main Step Slide Card */}
        <div
          ref={containerRef}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 shadow-[0_30px_120px_-80px_rgba(251,191,36,0.4)] backdrop-blur flex flex-col gap-6"
        >
          {/* Category Header */}
          {categoryData && !loading && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-300 border border-amber-400/30">
                    {currentStep + 1}
                  </span>
                  <h2 className="font-heading text-2xl text-white">
                    {categoryData.category_title}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-white/50 max-w-xl">
                  {categoryData.category_description}
                </p>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-80 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* 3 Component Option Cards */}
          {!loading && categoryData && (
            <div className="grid gap-4 sm:grid-cols-3">
              {categoryData.options.map((opt) => {
                const isSelected = selectedOption?.component?.name === opt.component?.name;
                const advisory = opt.component?.mismatch_advisory as
                  | { has_mismatch?: boolean; reason?: string }
                  | undefined;

                return (
                  <div
                    key={String(opt.component?.name)}
                    onClick={() => setSelectedOption(opt)}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition cursor-pointer ${
                      isSelected
                        ? "border-amber-400/60 bg-amber-400/15 text-white shadow-[0_0_24px_-6px_rgba(251,191,36,0.4)] ring-1 ring-amber-400/50"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <div>
                      {/* Top Role Badge & Price */}
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            opt.role === "AI Recommended"
                              ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                              : opt.role === "Value Option"
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                              : "border-purple-400/40 bg-purple-400/10 text-purple-300"
                          }`}
                        >
                          {opt.role}
                        </span>
                        <span className="text-base font-bold text-white tabular-nums">
                          {fmt(opt.price)}
                        </span>
                      </div>

                      {/* Component Name */}
                      <p className="mt-3 text-sm font-semibold text-white leading-snug line-clamp-2">
                        {String(opt.component?.name ?? "—")}
                      </p>
                      <p className="mt-1 text-[11px] text-white/40">
                        {opt.badge}
                      </p>

                      {/* Specs Grid */}
                      {opt.specs && Object.keys(opt.specs).length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                          {Object.entries(opt.specs).map(([k, v]) => (
                            <div key={k} className="flex flex-col">
                              <span className="text-[9px] uppercase tracking-wider text-white/35 font-medium">
                                {k}
                              </span>
                              <span className="text-[11px] font-semibold text-white/80 truncate leading-tight">
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mismatch Advisory without emojis */}
                      {advisory?.has_mismatch && advisory?.reason && (
                        <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-[11px] text-amber-200">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-amber-400 shrink-0 mt-0.5"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <span>{advisory.reason}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Pill */}
                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div
                        className={`w-full rounded-xl py-2 text-center text-xs font-semibold transition ${
                          isSelected
                            ? "bg-amber-300 text-slate-950 font-bold"
                            : "border border-white/10 bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select this option"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Component Difference & Comparison Accordion */}
          {!loading && categoryData && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowDiff((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Option Trade-offs & Analysis
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                    AI Evaluation
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs text-amber-300 hover:text-amber-200 transition flex items-center gap-1 cursor-pointer font-medium"
                >
                  {showDiff ? "Hide Details" : "View Comparison"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${showDiff ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>

              {showDiff && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                  <p className="text-xs text-white/80 leading-relaxed">
                    {categoryData.difference_analysis?.summary}
                  </p>
                  <div className="grid gap-2">
                    {categoryData.difference_analysis?.points?.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrevious}
              className="text-xs text-white/40 hover:text-white/70 transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              {currentStep === 0 ? "Back to Preferences" : "Previous Component"}
            </button>

            <button
              id="confirm-component-btn"
              type="button"
              disabled={!selectedOption || finalizing}
              onClick={handleConfirmSelection}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition shadow-lg ${
                selectedOption && !finalizing
                  ? "bg-amber-300 text-slate-950 shadow-amber-400/30 hover:bg-amber-200 cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {finalizing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Finalizing Build...
                </>
              ) : currentStep >= CATEGORY_ORDER.length - 1 ? (
                <>
                  Finalize Build
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </>
              ) : (
                <>
                  Next Component
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected Components Drawer Summary */}
        {Object.keys(selectedComponents).length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Selected Components ({Object.keys(selectedComponents).length} of {CATEGORY_ORDER.length})
              </h3>
              <span className="text-xs font-semibold text-amber-300">
                Total Spent: {fmt(spent)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {CATEGORY_ORDER.filter((cat) => selectedComponents[cat]).map((cat) => {
                const comp = selectedComponents[cat];
                const stepNum = CATEGORY_ORDER.indexOf(cat) + 1;
                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                        {stepNum}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-white/80 font-medium truncate block">
                          {String(comp.name ?? "—")}
                        </span>
                      </div>
                    </div>
                    <span className="text-white/60 font-medium shrink-0">
                      {fmt(Number(comp.price ?? 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
