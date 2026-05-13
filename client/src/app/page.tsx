import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-[-60px] top-[-40px] h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-[120px]" />
        <div className="absolute bottom-[-80px] left-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(16,185,129,0.06),transparent_40%),linear-gradient(240deg,rgba(56,189,248,0.08),transparent_50%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-12">
        <header className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-emerald-200/80">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              SmartBuild Decision Support
            </div>
            <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Build compatible PCs faster with a data-driven guide.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-200/80 sm:text-lg">
              SmartBuild simulates full custom builds using a local dataset,
              compatibility rules, and budget-aware scoring. Perfect for
              technicians who need fast, consistent recommendations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/recommendation"
                className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
              >
                Launch Simulation
              </Link>
              <Link
                href="/recommendation"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90"
              >
                View Sample Build
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-white/60">
              <span>Offline demo</span>
              <span>Rule-based compatibility</span>
              <span>Local pricing focus</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">What SmartBuild does</h2>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-widest text-cyan-200">
                Overview
              </span>
            </div>
            <div className="mt-6 grid gap-4 text-sm">
              {
                [
                  "Translate budgets into component allocations.",
                  "Match CPU sockets, RAM types, PSU headroom, and GPU clearance.",
                  "Surface best-value parts from the local dataset.",
                  "Provide a clear compatibility checklist for technicians.",
                ]
              .map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              Simulation builds typically generate in 6 to 9 seconds.
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          {
            [
              {
                title: "Compatibility first",
                body: "Every build checks sockets, memory generation, PSU headroom, and case clearance before it is shown.",
              },
              {
                title: "Budget-aware scoring",
                body: "Weights shift automatically to honor CPU-heavy, GPU-heavy, or storage-focused priorities.",
              },
              {
                title: "Technician-ready",
                body: "Clear recommendations, fast alternatives, and no server setup required for demos.",
              },
            ]
          .map((card) => (
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

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-white/5 to-transparent p-8">
            <h2 className="font-heading text-2xl">Simulation flow</h2>
            <p className="mt-3 text-sm text-white/70">
              From user input to a verified build, the flow stays lightweight
              while capturing the steps technicians already follow.
            </p>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              {[
                "1. Capture budget, usage intent, and priority.",
                "2. Allocate spend across CPU, GPU, RAM, and storage.",
                "3. Filter compatible parts and validate PSU + case fit.",
                "4. Return a ranked build with notes and totals.",
              ].map((step) => (
                <div
                  key={step}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="font-heading text-2xl">Ready to test it?</h2>
            <p className="mt-3 text-sm text-white/70">
              Try the simulation with mock data and preview the build output
              before you wire up any backend services.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/recommendation"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Open the recommendation lab
              </Link>
              <Link
                href="/recommendation"
                className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80"
              >
                View a sample output
              </Link>
            </div>
            <div className="mt-6 grid gap-3 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>Compatibility reliability</span>
                <span className="text-white">100%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Budget fit target</span>
                <span className="text-white">90%+</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Average runtime</span>
                <span className="text-white">&lt; 10s</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
