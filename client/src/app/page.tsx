import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute right-[-60px] top-[-40px] h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute bottom-[-80px] left-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(251,191,36,0.08),transparent_40%),linear-gradient(240deg,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-12">
        <header className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-amber-200/80">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              SmartBuild Decision Support
            </div>
            <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Build compatible PCs faster with a data-driven guide.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-200/80 sm:text-lg">
              SmartBuild uses advanced machine learning (Random Forest model) to
              recommend the most optimal and compatible PC components tailored
              specifically to your needs and budget.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/user-input"
                className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-200"
              >
                Start recommendation
              </Link>
              <Link
                href="/user-input"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                View Sample Build
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-white/60">
              <span>AI-powered recommendations</span>
              <span>Rule-based compatibility</span>
              <span>Local pricing focus</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">What SmartBuild does</h2>
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs uppercase tracking-widest text-blue-200">
                Overview
              </span>
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Recommendation preview</span>
                <span className="text-white/40">Sample output</span>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Budget range</span>
                    <span className="text-white">PHP 30k - 65k</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-amber-300/80 via-amber-200/70 to-blue-300/80" />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "CPU: Ryzen 5 5600",
                    "GPU: RTX 4060",
                    "RAM: 16GB DDR4",
                    "Storage: 1TB NVMe",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
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
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              AI builds typically generate in 6 to 9 seconds.
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

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl">How the AI recommendation works</h2>
              <p className="mt-2 text-sm text-white/70">
                A fast, transparent pipeline from your requirements to a validated build.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-widest text-amber-200">
              Timeline
            </span>
          </div>
          <div className="mt-6 grid gap-4 text-sm md:grid-cols-5">
            {[
              { label: "Input", detail: "Budget + usage intent" },
              { label: "Classify", detail: "AI intent weights" },
              { label: "Predict", detail: "RF tier selection" },
              { label: "Validate", detail: "Compatibility rules" },
              { label: "Recommend", detail: "Build + cost" },
            ].map((step) => (
              <div
                key={step.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                  {step.label}
                </p>
                <p className="mt-2 text-sm text-white/80">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/10 via-white/5 to-transparent p-8">
            <h2 className="font-heading text-2xl">What you provide</h2>
            <p className="mt-3 text-sm text-white/70">
              The AI asks for a few key details to understand your requirements
              and generate the best possible build.
            </p>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              {[
                "1. Budget range — minimum and maximum spend.",
                "2. Primary activity — Gaming, Video Editing, 3D Modeling, etc.",
                "3. Secondary activity (optional) — to balance the build further.",
                "4. Expected longevity — 1–2, 3–5, or 5+ years.",
                "5. Upgrade openness — future-proof with newer platforms?",
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
            <h2 className="font-heading text-2xl">Ready to build?</h2>
            <p className="mt-3 text-sm text-white/70">
              Start the recommendation process and get a complete, compatible PC
              build tailored to your exact needs and budget.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/user-input"
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Start recommendation
              </Link>
              <Link
                href="/user-input"
                className="rounded-2xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/5"
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
