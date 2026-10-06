"use client";

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

        {/* Hero */}
        <header className="grid gap-10 lg:grid-cols-2 lg:items-center">

          {/* Left — headline + CTA */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-amber-200/80">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              SmartBuild PC Advisor
            </div>
            <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Get your perfect PC build — no tech expertise needed.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-200/80 sm:text-lg">
              Just tell SmartBuild your budget and what you plan to do with your
              computer. Our AI picks the best parts, makes sure they all work
              together, and gives you a ready-to-build list in seconds.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/user-input"
                id="hero-start-btn"
                className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-200"
              >
                Start My Build
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-white/60">
              <span>AI-powered picks</span>
              <span>All parts guaranteed compatible</span>
              <span>Philippine pricing</span>
            </div>
          </div>

          {/* Right — mini video player */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-amber-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
              First-time here? Watch the walkthrough
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl group">
              <div className="relative aspect-video w-full">
                <video
                  id="hero-guide-video"
                  controls
                  poster="/video-guide-placeholder.jpg"
                  className="h-full w-full object-cover"
                >
                  <source src="/videos/user-guide.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                {/* Fullscreen button - fades in on hover */}
                <button
                  type="button"
                  aria-label="View fullscreen"
                  onClick={() => {
                    const v = document.getElementById("hero-guide-video") as HTMLVideoElement | null;
                    if (v?.requestFullscreen) v.requestFullscreen();
                  }}
                  className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                  Fullscreen
                </button>

                {/* Label chips */}
                <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
                  <span className="rounded-full bg-black/60 backdrop-blur px-2.5 py-1 border border-white/10 font-mono text-[10px] text-white/70">
                    SmartBuild Quickstart
                  </span>
                  <span className="rounded-full bg-amber-400/20 backdrop-blur px-2.5 py-1 border border-amber-400/30 text-amber-200 font-medium text-[10px]">
                    Video Guide
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-white/35 text-right">
              A short walkthrough on how to get your build in seconds.
            </p>
          </div>
        </header>

        {/* What SmartBuild does */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl">What SmartBuild does</h2>
            <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs uppercase tracking-widest text-blue-200">
              Overview
            </span>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Sample recommendation</span>
              <span className="text-white/40">Example output</span>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Budget range</span>
                  <span className="text-white">₱30,000 – ₱65,000</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-amber-300/80 via-amber-200/70 to-blue-300/80" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "Processor (CPU)",
                  "Graphics Card (GPU)",
                  "Memory (RAM)",
                  "Storage (SSD)",
                  "Motherboard",
                  "Power Supply",
                  "CPU Cooler",
                  "PC Case",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            {[
              "Picks the best parts that fit your budget.",
              "Checks that every part works together before showing you the build.",
              "Finds the best value from a comprehensive database of components.",
              "Gives you a clear, easy-to-understand parts list.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white/80">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Your build is typically ready in under 10 seconds.
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Everything fits together",
              body: "SmartBuild automatically checks that your processor, graphics card, memory, and other parts are all compatible — so you never end up with pieces that don't connect.",
            },
            {
              title: "Stays within your budget",
              body: "Tell us how much you want to spend and the system finds the best combination of parts without going over your limit.",
            },
            {
              title: "Built for everyone",
              body: "Whether you're a first-time builder or a shop technician, SmartBuild gives clear, jargon-free recommendations you can act on right away.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-heading text-xl">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{card.body}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl">How it works</h2>
              <p className="mt-2 text-sm text-white/70">
                A simple, step-by-step process from your preferences to a complete parts list.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-widest text-amber-200">
              Steps
            </span>
          </div>
          <div className="mt-6 grid gap-4 text-sm md:grid-cols-5">
            {[
              { label: "1. Tell us",    detail: "Enter your budget and what you'll use the PC for" },
              { label: "2. We analyze", detail: "The AI figures out which types of parts you need most" },
              { label: "3. Pick parts", detail: "It selects specific components that match your needs" },
              { label: "4. Check fit",  detail: "Every part is verified to work together perfectly" },
              { label: "5. Your build", detail: "You get a complete parts list with prices" },
            ].map((step) => (
              <div key={step.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">{step.label}</p>
                <p className="mt-2 text-sm text-white/80">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we ask + CTA */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/10 via-white/5 to-transparent p-8">
            <h2 className="font-heading text-2xl">What we ask you</h2>
            <p className="mt-3 text-sm text-white/70">
              Just a few simple questions — no technical knowledge required.
            </p>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              {[
                "1. Your budget — how much you want to spend (min and max).",
                "2. Primary use — what you'll mostly do (gaming, editing, office work, etc.).",
                "3. Secondary use (optional) — anything else you'll do often.",
                "4. Preferred CPU cooling type — air cooling, liquid AIO, or auto-detect.",
                "5. Target display — your monitor's resolution & refresh rate.",
              ].map((step) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="font-heading text-2xl">Ready to build?</h2>
            <p className="mt-3 text-sm text-white/70">
              Answer a few quick questions and get a complete, ready-to-buy PC
              parts list matched to your exact needs and budget.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/user-input"
                id="cta-start-btn"
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Start My Build
              </Link>
            </div>
            <div className="mt-6 grid gap-3 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>All parts guaranteed compatible</span>
                <span className="text-white">✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Stays within your budget</span>
                <span className="text-white">✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Build ready in seconds</span>
                <span className="text-white">✓</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Admin portal link */}
      <footer className="relative border-t border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xs text-white/20">
            © {new Date().getFullYear()} SmartBuild
          </span>
          <Link
            href="/admin/login"
            id="admin-portal-link"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/30 transition hover:border-white/20 hover:bg-white/10 hover:text-white/60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M8 1a3.5 3.5 0 1 0 0 7A3.5 3.5 0 0 0 8 1ZM4.5 4.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0ZM2 13.5A3.5 3.5 0 0 1 5.5 10h5a3.5 3.5 0 0 1 3.5 3.5v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-.5Z" clipRule="evenodd" />
            </svg>
            Admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
