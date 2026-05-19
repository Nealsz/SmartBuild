"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ACTIVITY_OPTIONS = [
  "Browsing & Streaming",
  "Documents / Office Work",
  "Gaming",
  "Video Editing",
  "Photo / Graphic Design",
  "3D Modeling or Animation",
  "Music Production",
  "Programming or Development",
  "Streaming / Recording",
  "Simulations / Data Analysis",
];

const LONGEVITY_OPTIONS = [
  { value: "1-2 years", label: "1–2 years", description: "Current-gen on a strict budget" },
  { value: "3-5 years", label: "3–5 years", description: "Balanced long-term usability" },
  { value: "5+ years", label: "5+ years", description: "Enthusiast-tier longevity" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function UserInputPage() {
  const router = useRouter();

  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [primaryActivity, setPrimaryActivity] = useState("");
  const [secondaryActivity, setSecondaryActivity] = useState("");
  const [longevity, setLongevity] = useState("3-5 years");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currencyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  const parseBudget = (val: string) =>
    Number.parseInt(val.replace(/,/g, ""), 10) || 0;

  const canSubmit =
    parseBudget(minBudget) > 0 &&
    parseBudget(maxBudget) > 0 &&
    parseBudget(maxBudget) >= parseBudget(minBudget) &&
    primaryActivity !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
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
          longevity,
          upgrade_open: upgradeOpen,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Server error (${res.status})`);
      }

      const result = await res.json();
      // Store result in sessionStorage for the build-result page
      sessionStorage.setItem("smartbuild_result", JSON.stringify(result));
      sessionStorage.setItem(
        "smartbuild_input",
        JSON.stringify({
          min_budget: parseBudget(minBudget),
          max_budget: parseBudget(maxBudget),
          primary_activity: primaryActivity,
          secondary_activity: secondaryActivity || null,
          longevity,
          upgrade_open: upgradeOpen,
        })
      );
      router.push("/build-result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

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

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-24 pt-12">
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
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Tell us about your ideal PC.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
            Fill in your requirements below and our AI-powered engine will
            recommend the most optimal and compatible PC components tailored to
            your needs and budget.
          </p>
        </header>

        {/* Form Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_30px_120px_-80px_rgba(251,191,36,0.4)] backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl">Your requirements</h2>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-widest text-amber-200">
              Input
            </span>
          </div>

          <div className="mt-8 grid gap-8">
            {/* ─── Budget ─────────────────────────────────────── */}
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-200/90">
                Budget Allocation
              </label>
              <p className="text-xs text-white/50 -mt-1">
                Set the minimum and maximum amount you are willing to spend. The
                AI will maximize performance within this range.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/40">₱</span>
                  <input
                    id="budget-min"
                    type="text"
                    inputMode="numeric"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                    placeholder="Minimum Budget"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 pl-8 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none transition"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/40">₱</span>
                  <input
                    id="budget-max"
                    type="text"
                    inputMode="numeric"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="Maximum Budget"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 pl-8 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none transition"
                  />
                </div>
              </div>
              {parseBudget(minBudget) > 0 && parseBudget(maxBudget) > 0 && (
                <p className="text-xs text-white/50">
                  Budget window:{" "}
                  {currencyFormatter.format(parseBudget(minBudget))} –{" "}
                  {currencyFormatter.format(parseBudget(maxBudget))}
                  {parseBudget(maxBudget) < parseBudget(minBudget) && (
                    <span className="ml-2 text-red-400">
                      Maximum must be ≥ minimum
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* ─── Primary Activity ──────────────────────────── */}
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-200/90">
                Primary Activity
              </label>
              <p className="text-xs text-white/50 -mt-1">
                Select the main purpose of this PC. The AI weighs hardware
                importance differently based on this choice.
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {ACTIVITY_OPTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    id={`primary-${label.replace(/[\s\/&]/g, "-").toLowerCase()}`}
                    onClick={() => setPrimaryActivity(label)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      primaryActivity === label
                        ? "border-amber-400/60 bg-amber-400/15 text-white shadow-[0_0_20px_-8px_rgba(251,191,36,0.3)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition ${
                        primaryActivity === label
                          ? "bg-amber-300"
                          : "bg-white/20"
                      }`}
                    />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Secondary Activity (optional) ─────────────── */}
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-200/90">
                Secondary Activity{" "}
                <span className="text-white/40 font-normal">(Optional)</span>
              </label>
              <p className="text-xs text-white/50 -mt-1">
                If you plan to use the PC for a secondary purpose, select it
                here. This helps the AI balance the build further.
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <button
                  type="button"
                  id="secondary-none"
                  onClick={() => setSecondaryActivity("")}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    secondaryActivity === ""
                      ? "border-blue-400/60 bg-blue-400/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      secondaryActivity === "" ? "bg-blue-300" : "bg-white/20"
                    }`}
                  />
                  None
                </button>
                {ACTIVITY_OPTIONS.filter((a) => a !== primaryActivity).map(
                  (label) => (
                    <button
                      key={label}
                      type="button"
                      id={`secondary-${label.replace(/[\s\/&]/g, "-").toLowerCase()}`}
                      onClick={() => setSecondaryActivity(label)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        secondaryActivity === label
                          ? "border-blue-400/60 bg-blue-400/15 text-white shadow-[0_0_20px_-8px_rgba(59,130,246,0.3)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full transition ${
                          secondaryActivity === label
                            ? "bg-blue-300"
                            : "bg-white/20"
                        }`}
                      />
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* ─── Expected Longevity ────────────────────────── */}
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-200/90">
                Expected Longevity
              </label>
              <p className="text-xs text-white/50 -mt-1">
                How long do you expect this build to remain highly capable?
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {LONGEVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`longevity-${opt.value.replace(/[\s+]/g, "-").toLowerCase()}`}
                    onClick={() => setLongevity(opt.value)}
                    className={`flex flex-col gap-1 rounded-2xl border px-4 py-4 text-left transition ${
                      longevity === opt.value
                        ? "border-emerald-400/60 bg-emerald-400/15 text-white shadow-[0_0_20px_-8px_rgba(52,211,153,0.3)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-white/50">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Upgrade Openness ──────────────────────────── */}
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-200/90">
                Open to Future Upgrades?
              </label>
              <p className="text-xs text-white/50 -mt-1">
                If yes, the AI may select newer platforms and higher wattage PSUs
                to accommodate future, more powerful components.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  id="upgrade-yes"
                  onClick={() => setUpgradeOpen(true)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    upgradeOpen
                      ? "border-emerald-400/60 bg-emerald-400/15 text-white shadow-[0_0_20px_-8px_rgba(52,211,153,0.3)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      upgradeOpen ? "bg-emerald-300" : "bg-white/20"
                    }`}
                  />
                  Yes — future-proof my build
                </button>
                <button
                  type="button"
                  id="upgrade-no"
                  onClick={() => setUpgradeOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    !upgradeOpen
                      ? "border-emerald-400/60 bg-emerald-400/15 text-white shadow-[0_0_20px_-8px_rgba(52,211,153,0.3)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      !upgradeOpen ? "bg-emerald-300" : "bg-white/20"
                    }`}
                  />
                  No — optimize for now
                </button>
              </div>
            </div>
          </div>

          {/* ─── Error Message ───────────────────────────────── */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* ─── Submit ──────────────────────────────────────── */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              id="generate-build-btn"
              type="button"
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
              className={`rounded-full px-8 py-3.5 text-sm font-semibold transition shadow-lg ${
                canSubmit && !loading
                  ? "bg-amber-300 text-slate-950 shadow-amber-400/30 hover:bg-amber-200 cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating Build…
                </span>
              ) : (
                "Generate Build"
              )}
            </button>
            {!canSubmit && !loading && (
              <p className="text-xs text-white/40">
                {primaryActivity === ""
                  ? "Select a primary activity to continue."
                  : "Enter a valid budget range to continue."}
              </p>
            )}
          </div>
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
