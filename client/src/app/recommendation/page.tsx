import { Button } from "@/components/ui/button";

export default function RecommendationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 pb-24 pt-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-emerald-200/70">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            SmartBuild Recommendation
          </div>
          <h1 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Enter your PC build requirements.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
            Provide budget, usage, and preferences so SmartBuild can generate a
            compatible configuration based on local pricing.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl">Input requirements</h2>
          </div>
          <div className="mt-6 grid gap-6">
            <div className="grid gap-2">
              <label className="text-sm text-slate-200/80">Budget range</label>
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
              <label className="text-sm text-slate-200/80">Primary usage</label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  "Gaming",
                  "Content creation",
                  "Office and study",
                  "Engineering",
                ].map((label) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="lg"
                    className="h-auto justify-start rounded-2xl border-white/10 bg-white/5 px-4 py-3 text-left text-white/80 hover:bg-white/10"
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
              <div className="grid grid-cols-2 gap-3 text-sm">
                {["CPU-heavy", "GPU-heavy", "Balanced", "Storage and RAM"].map(
                  (label) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="lg"
                      className="h-auto justify-start rounded-2xl border-white/10 bg-white/5 px-4 py-3 text-left text-white/80 hover:bg-white/10"
                    >
                      {label}
                    </Button>
                  ),
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-slate-200/80">
                Preferred brands
              </label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {["Any", "AMD", "Intel", "NVIDIA"].map((label) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="lg"
                    className="h-auto justify-start rounded-2xl border-white/10 bg-white/5 px-4 py-3 text-left text-white/80 hover:bg-white/10"
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
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white/90"
            >
              Recommend build
            </Button>
            <p className="text-xs text-white/50">
              Estimated response: under 15 seconds.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
