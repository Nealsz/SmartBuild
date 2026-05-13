import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-10">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-emerald-200/70">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            SmartBuild Decision Support
          </div>
          <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Build a compatible PC in minutes, tuned for Philippine pricing.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-200/80 sm:text-lg">
            SmartBuild recommends a full custom build using your budget, usage,
            and component priorities. The system validates compatibility and
            highlights the best value parts for local availability.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/recommendation"
              className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
            >
              Generate Recommendation
            </Link>
            <Link
              href="/recommendation"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90"
            >
              View Sample Build
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">Input requirements</h2>
              <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
                Step 1
              </span>
            </div>
            <div className="mt-6 grid gap-6">
              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Budget range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Min (PHP)"
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-white/30"
                  />
                  <input
                    placeholder="Max (PHP)"
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-white/30"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Primary usage
                </label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    "Gaming",
                    "Content creation",
                    "Office and study",
                    "Engineering",
                  ].map((label) => (
                    <button
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white/80"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Performance priority
                </label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    "CPU-heavy",
                    "GPU-heavy",
                    "Balanced",
                    "Storage and RAM",
                  ].map((label) => (
                    <button
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white/80"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-slate-200/80">
                  Preferred brands
                </label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {["Any", "AMD", "Intel", "NVIDIA"].map((label) => (
                    <button
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white/80"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950">
                Recommend build
              </button>
              <p className="text-xs text-white/50">
                Estimated response: under 15 seconds.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">Suggested build</h2>
              <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs uppercase tracking-widest text-cyan-200">
                Output
              </span>
            </div>
            <div className="mt-6 grid gap-4 text-sm">
              {[
                { name: "CPU", value: "Ryzen 5 7600" },
                { name: "GPU", value: "RTX 4060 8GB" },
                { name: "Motherboard", value: "B650M WiFi" },
                { name: "Memory", value: "32GB DDR5" },
                { name: "Storage", value: "1TB NVMe Gen4" },
                { name: "PSU", value: "650W Gold" },
              ].map((part) => (
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
              Compatibility check passed. Total build cost estimated at PHP
              58,400.
            </div>
            <div className="mt-6 grid gap-3 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>Intended-use alignment</span>
                <span className="text-white">90%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Budget fit</span>
                <span className="text-white">95%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recommendation speed</span>
                <span className="text-white">7s</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Compatibility first",
              body: "Rule-based checks validate sockets, memory generations, and power headroom before a build is shown.",
            },
            {
              title: "Local pricing",
              body: "Data sources are localized to Philippine retailers so totals reflect your actual spend.",
            },
            {
              title: "Fast decisions",
              body: "Recommendations return in seconds, saving time for both customers and technicians.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h3 className="font-heading text-xl">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                {card.body}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
