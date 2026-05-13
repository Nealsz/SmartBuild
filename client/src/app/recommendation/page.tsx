"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import mockData from "./../../../data/components.json";

type Cpu = (typeof mockData.cpus)[number];
type Gpu = (typeof mockData.gpus)[number];
type Motherboard = (typeof mockData.motherboards)[number];
type Ram = (typeof mockData.rams)[number];
type Storage = (typeof mockData.storages)[number];
type Psu = (typeof mockData.psus)[number];
type Case = (typeof mockData.cases)[number];

type BuildResult = {
  cpu: Cpu;
  gpu: Gpu;
  motherboard: Motherboard;
  ram: Ram;
  storage: Storage;
  psu: Psu;
  pcCase: Case;
  total: number;
  compatibilityNotes: string[];
  budgetFit: number;
  recommendationSpeed: string;
};

const usageOptions = Array.from(
  new Set(mockData.usage_keywords.map((item) => item.usage)),
);

const priorityOptions = [
  "CPU-heavy",
  "GPU-heavy",
  "Balanced",
  "Storage and RAM",
];

const brandOptions = ["Any", "AMD", "Intel", "NVIDIA"];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatPrice = (value: number) => currencyFormatter.format(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const pickHighestScore = <T extends { price: number }>(
  items: T[],
  budget: number,
  getScore: (item: T) => number,
) => {
  const withinBudget = items.filter((item) => item.price <= budget);
  if (withinBudget.length === 0) {
    return items.reduce((lowest, item) =>
      item.price < lowest.price ? item : lowest,
    );
  }
  return withinBudget.reduce((best, item) =>
    getScore(item) > getScore(best) ? item : best,
  );
};

const pickAffordable = <T extends { price: number }>(
  items: T[],
  budget: number,
  fallback: T[],
) => {
  const withinBudget = items.filter((item) => item.price <= budget);
  if (withinBudget.length > 0) {
    return withinBudget.reduce((best, item) =>
      item.price > best.price ? item : best,
    );
  }
  return fallback.reduce((lowest, item) =>
    item.price < lowest.price ? item : lowest,
  );
};

const filterCpuByBrand = (brand: string) => {
  if (brand === "AMD") {
    return mockData.cpus.filter((cpu) => cpu.name.includes("Ryzen"));
  }
  if (brand === "Intel") {
    return mockData.cpus.filter((cpu) => cpu.name.includes("Intel"));
  }
  return mockData.cpus;
};

const filterGpuByBrand = (brand: string) => {
  if (brand === "AMD") {
    return mockData.gpus.filter((gpu) => gpu.name.includes("RX"));
  }
  if (brand === "NVIDIA") {
    return mockData.gpus.filter(
      (gpu) => gpu.name.includes("RTX") || gpu.name.includes("GTX"),
    );
  }
  return mockData.gpus;
};

const buildSimulation = (params: {
  budgetMin: number;
  budgetMax: number;
  priority: string;
  brand: string;
}): BuildResult => {
  const maxBudget = params.budgetMax;
  const allocations = {
    cpu: 0.24,
    gpu: 0.34,
    motherboard: 0.12,
    ram: 0.1,
    storage: 0.08,
    psu: 0.07,
    pcCase: 0.05,
  };

  if (params.priority === "CPU-heavy") {
    allocations.cpu += 0.09;
    allocations.gpu -= 0.05;
    allocations.storage -= 0.02;
    allocations.pcCase -= 0.02;
  }
  if (params.priority === "GPU-heavy") {
    allocations.gpu += 0.12;
    allocations.cpu -= 0.06;
    allocations.storage -= 0.03;
    allocations.pcCase -= 0.03;
  }
  if (params.priority === "Storage and RAM") {
    allocations.storage += 0.06;
    allocations.ram += 0.05;
    allocations.cpu -= 0.06;
    allocations.gpu -= 0.05;
  }

  const cpuPool = filterCpuByBrand(params.brand);
  const gpuPool = filterGpuByBrand(params.brand);

  const cpu = pickHighestScore(
    cpuPool,
    maxBudget * allocations.cpu,
    (item) => item.cpu_score,
  );
  const gpu = pickHighestScore(
    gpuPool,
    maxBudget * allocations.gpu,
    (item) => item.gpu_score,
  );

  const ramCandidates = mockData.rams.filter((ram) => ram.capacity >= 16);
  const ram = pickAffordable(
    ramCandidates,
    maxBudget * allocations.ram,
    mockData.rams,
  );

  const motherboardMatches = mockData.motherboards.filter(
    (board) => board.socket === cpu.socket && board.ram_type === ram.type,
  );
  const motherboard = pickAffordable(
    motherboardMatches,
    maxBudget * allocations.motherboard,
    mockData.motherboards,
  );

  const storage = pickAffordable(
    mockData.storages.filter((drive) => drive.type === "NVMe"),
    maxBudget * allocations.storage,
    mockData.storages,
  );

  const requiredWattage = Math.max(
    gpu.recommended_psu,
    cpu.tdp + gpu.tdp + 150,
  );
  const psuCandidates = mockData.psus.filter(
    (unit) => unit.wattage >= requiredWattage,
  );
  const psu = pickAffordable(
    psuCandidates,
    maxBudget * allocations.psu,
    mockData.psus,
  );

  const caseCandidates = mockData.cases.filter(
    (pcCase) =>
      pcCase.supported_form_factors.includes(motherboard.form_factor) &&
      pcCase.max_gpu_length >= gpu.length,
  );
  const pcCase = pickAffordable(
    caseCandidates,
    maxBudget * allocations.pcCase,
    mockData.cases,
  );

  const total =
    cpu.price +
    gpu.price +
    motherboard.price +
    ram.price +
    storage.price +
    psu.price +
    pcCase.price;

  const compatibilityNotes = [
    `Socket match: ${cpu.socket} + ${motherboard.name}.`,
    `RAM type: ${ram.type} supported on ${motherboard.name}.`,
    `GPU clearance: ${gpu.length}mm within ${pcCase.max_gpu_length}mm.`,
    `PSU headroom: ${psu.wattage}W for ${requiredWattage}W requirement.`,
  ];

  const withinRange = total >= params.budgetMin && total <= params.budgetMax;
  const budgetFit = clamp(
    Math.round(
      ((maxBudget - total) / maxBudget) * 100 + (withinRange ? 88 : 78),
    ),
    70,
    98,
  );

  return {
    cpu,
    gpu,
    motherboard,
    ram,
    storage,
    psu,
    pcCase,
    total,
    compatibilityNotes,
    budgetFit,
    recommendationSpeed: "6.8s",
  };
};

export default function RecommendationPage() {
  const [budgetMin, setBudgetMin] = useState("30000");
  const [budgetMax, setBudgetMax] = useState("65000");
  const [usage, setUsage] = useState(usageOptions[0]);
  const [priority, setPriority] = useState(priorityOptions[2]);
  const [brand, setBrand] = useState(brandOptions[0]);
  const [result, setResult] = useState<BuildResult | null>(null);

  const normalizedBudget = useMemo(() => {
    const minValue = Number.parseInt(budgetMin.replace(/,/g, ""), 10) || 0;
    const maxValue = Number.parseInt(budgetMax.replace(/,/g, ""), 10) || 0;
    if (maxValue === 0) {
      return { min: minValue, max: minValue };
    }
    if (minValue > maxValue) {
      return { min: maxValue, max: minValue };
    }
    return { min: minValue, max: maxValue };
  }, [budgetMin, budgetMax]);

  const handleRecommend = () => {
    const maxBudget = Math.max(normalizedBudget.max, 20000);
    setResult(
      buildSimulation({
        budgetMin: normalizedBudget.min,
        budgetMax: maxBudget,
        priority,
        brand,
      }),
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            SmartBuild Simulation Lab
          </div>
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Simulate a complete PC build in seconds.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
            This screen runs fully offline. We use mock component data to
            simulate compatibility checks, budget fit, and recommendation speed.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_30px_120px_-80px_rgba(16,185,129,0.6)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">Input requirements</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
                Simulation
              </span>
            </div>
            <div className="mt-6 grid gap-6">
              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Budget range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={budgetMin}
                    onChange={(event) => setBudgetMin(event.target.value)}
                    placeholder="Min (PHP)"
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none"
                  />
                  <input
                    value={budgetMax}
                    onChange={(event) => setBudgetMax(event.target.value)}
                    placeholder="Max (PHP)"
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-white/50">
                  Budget window: {formatPrice(normalizedBudget.min)} -{" "}
                  {formatPrice(normalizedBudget.max)}
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Primary usage
                </label>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {usageOptions.map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="lg"
                      onClick={() => setUsage(label)}
                      className={`h-auto justify-start rounded-2xl border-white/10 px-4 py-3 text-left text-white/80 transition ${
                        usage === label
                          ? "border-emerald-400/60 bg-emerald-400/15 text-white"
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Performance priority
                </label>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {priorityOptions.map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="lg"
                      onClick={() => setPriority(label)}
                      className={`h-auto justify-start rounded-2xl border-white/10 px-4 py-3 text-left text-white/80 transition ${
                        priority === label
                          ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Preferred brands
                </label>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {brandOptions.map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="lg"
                      onClick={() => setBrand(label)}
                      className={`h-auto justify-start rounded-2xl border-white/10 px-4 py-3 text-left text-white/80 transition ${
                        brand === label
                          ? "border-sky-300/70 bg-sky-300/15 text-white"
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={handleRecommend}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Simulate recommendation
              </Button>
              <p className="text-xs text-white/50">
                Offline simulation. Estimated response: 6 to 9 seconds.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-7">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">Recommended build</h2>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-widest text-cyan-200">
                Output
              </span>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              {(result
                ? [
                    { name: "CPU", value: result.cpu.name },
                    { name: "GPU", value: result.gpu.name },
                    { name: "Motherboard", value: result.motherboard.name },
                    { name: "Memory", value: result.ram.name },
                    { name: "Storage", value: result.storage.name },
                    { name: "PSU", value: result.psu.name },
                    { name: "Case", value: result.pcCase.name },
                  ]
                : [
                    { name: "CPU", value: "Awaiting input" },
                    { name: "GPU", value: "Awaiting input" },
                    { name: "Motherboard", value: "Awaiting input" },
                    { name: "Memory", value: "Awaiting input" },
                    { name: "Storage", value: "Awaiting input" },
                    { name: "PSU", value: "Awaiting input" },
                    { name: "Case", value: "Awaiting input" },
                  ]
              ).map((part) => (
                <div
                  key={part.name}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="text-white/60">{part.name}</span>
                  <span className="text-white">{part.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              {result
                ? `Compatibility check passed. Total build cost ${formatPrice(
                    result.total,
                  )}.`
                : "Run the simulation to generate a complete build."}
            </div>

            <div className="mt-6 grid gap-3 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>Usage target</span>
                <span className="text-white">{usage}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Budget fit</span>
                <span className="text-white">
                  {result ? `${result.budgetFit}%` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Usage alignment</span>
                <span className="text-white">{result ? "92%" : "--"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recommendation speed</span>
                <span className="text-white">
                  {result ? result.recommendationSpeed : "--"}
                </span>
              </div>
            </div>

            {result && (
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
                <p className="text-sm font-semibold text-white">
                  Compatibility notes
                </p>
                {result.compatibilityNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
