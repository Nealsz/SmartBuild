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
              Get the right PC parts — no guesswork needed.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-200/80 sm:text-lg">
              Tell SmartBuild what you want to do and how much you can spend.
              Our AI picks the best parts that work together and fit your budget.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/user-input"
                className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-200"
              >
                Start recommendation
              </Link>

            </div>
            <div className="flex flex-wrap gap-6 text-xs text-white/60">
              <span>AI-powered picks</span>
              <span>All parts guaranteed to fit</span>
              <span>Philippine pricing</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">Quality Checks</h2>
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs uppercase tracking-widest text-blue-200">
                5 Checks
              </span>
            </div>
            <div className="mt-6 grid gap-3">
              {[
                { icon: "🎯", label: "Smart Picks", desc: "The AI is confident it chose the right category of parts for you", target: "≥ 85%" },
                { icon: "💰", label: "Budget Fit", desc: "Your total build cost stays within the range you set", target: "≥ 90%" },
                { icon: "🧭", label: "Right Parts for You", desc: "Parts are prioritized based on what you actually need", target: "≥ 85%" },
                { icon: "🔗", label: "Everything Fits", desc: "All selected parts are guaranteed to work together", target: "100%" },
                { icon: "⚡", label: "Fast Results", desc: "You get your recommendation in seconds, not hours", target: "≤ 15s" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{kpi.icon}</span>
                      <span className="text-sm font-medium text-white/90">{kpi.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-amber-200">{kpi.target}</span>
                  </div>
                  <p className="mt-1 pl-7 text-xs text-white/50">{kpi.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Every build is automatically checked against all 5 quality measures.
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          {
            [
              {
                title: "Picks what matters most",
                body: "If you game, it focuses on graphics. If you edit videos, it prioritizes processing power. SmartBuild understands what each activity needs most.",
              },
              {
                title: "Everything works together",
                body: "No mismatched parts. SmartBuild checks that your processor fits the motherboard, memory is the right type, power supply is strong enough, and everything fits in the case.",
              },
              {
                title: "Best value for your money",
                body: "Your budget is spread smartly across all parts — more goes to the components that matter most for what you do, without wasting money on parts you don't need.",
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
              <h2 className="font-heading text-2xl">How it works</h2>
              <p className="mt-2 text-sm text-white/70">
                From your answers to a complete PC build in seconds.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-widest text-amber-200">
              Timeline
            </span>
          </div>
          <div className="mt-6 grid gap-4 text-sm md:grid-cols-6">
            {[
              { label: "Step 1", detail: "You tell us your budget and what you'll use the PC for" },
              { label: "Step 2", detail: "The AI figures out which level of parts you need" },
              { label: "Step 3", detail: "It picks the best specific parts in your price range" },
              { label: "Step 4", detail: "All parts are checked to make sure they fit together" },
              { label: "Step 5", detail: "The total cost is calculated and compared to your budget" },
              { label: "Step 6", detail: "The build is scored on 5 quality measures" },
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
            <h2 className="font-heading text-2xl">Just answer 5 questions</h2>
            <p className="mt-3 text-sm text-white/70">
              No technical knowledge needed. We just need a few details
              about how you plan to use your PC.
            </p>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              {[
                "1. How much can you spend? (minimum and maximum)",
                "2. What will you mainly use the PC for? (Gaming, Work, etc.)",
                "3. Anything else you'll do on it? (optional)",
                "4. How long should it last? (1–2, 3–5, or 5+ years)",
                "5. Do you want the option to upgrade parts later?",
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
            <h2 className="font-heading text-2xl">Ready to get started?</h2>
            <p className="mt-3 text-sm text-white/70">
              Answer a few quick questions and get a complete PC parts list
              that fits your needs and your wallet.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/user-input"
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Start recommendation
              </Link>

            </div>
            <div className="mt-6 grid gap-3 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>AI confidence in picks</span>
                <span className="text-white">≥ 85%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Stays within your budget</span>
                <span className="text-white">≥ 90%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Right parts for your needs</span>
                <span className="text-white">≥ 85%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>All parts work together</span>
                <span className="text-white">100%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Results delivered in</span>
                <span className="text-white">≤ 15 seconds</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
