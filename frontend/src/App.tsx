import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import logoImage from "./assets/brand/logo.png";

type BuildComponent = {
  name: string;
  brand: string;
  price: number;
  performance: number;
};

type GenerateBuildResponse = {
  message: string;
  issues?: string[];
  build?: Record<string, BuildComponent>;
};

const componentCatalog: Record<string, string[]> = {
  CPU: ["Intel", "AMD"],
  GPU: ["NVIDIA", "AMD"],
  RAM: ["Corsair", "G.Skill"],
  Storage: ["Samsung", "Western Digital"],
  Motherboard: ["ASUS", "MSI"],
  PSU: ["Corsair", "EVGA"],
  Case: ["NZXT", "Cooler Master"]
};

const usageOptions = ["gaming", "professional work", "general use"];
const categoryOptions = Object.keys(componentCatalog);
const priorityComponentInfo: Record<string, string> = {
  CPU: "Impacts overall processing speed, multitasking, and application performance.",
  GPU: "Drives graphics quality, gaming frame rates, and GPU-heavy creative workloads.",
  RAM: "Affects how many apps/tasks run smoothly at the same time.",
  Storage: "Influences boot/load times and total space for files, games, and software.",
  Motherboard: "Determines compatibility, upgrade options, and connectivity features.",
  PSU: "Provides stable power and supports safe operation of all selected components.",
  Case: "Affects airflow, cooling potential, build size, and overall component fit."
};
const toTitleCase = (text: string) =>
  text.replace(/\b\w/g, (char) => char.toUpperCase());

function UserInputPage() {
  const navigate = useNavigate();
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [usage, setUsage] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [priorityTooltip, setPriorityTooltip] = useState<{
    category: string;
    x: number;
    y: number;
  } | null>(null);
  const [brandPreferences, setBrandPreferences] = useState<Record<string, string>>(
    Object.fromEntries(categoryOptions.map((category) => [category, ""]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const min = Number(budgetMin);
    const max = Number(budgetMax);
    return (
      budgetMin.trim() !== "" &&
      budgetMax.trim() !== "" &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min > 0 &&
      max >= min &&
      usage.trim() !== "" &&
      selectedPriorities.length > 0
    );
  }, [budgetMax, budgetMin, selectedPriorities.length, usage]);

  const togglePriority = (value: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/generate-build/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_min: Number(budgetMin),
          budget_max: Number(budgetMax),
          usage,
          performance_priority: selectedPriorities,
          brand_preferences: Object.fromEntries(
            Object.entries(brandPreferences).filter(([, brand]) => brand.trim() !== "")
          )
        })
      });

      const data = (await response.json()) as GenerateBuildResponse;
      if (!response.ok) {
        throw new Error(data.message || "Failed to generate build.");
      }

      navigate("/build-result", { state: { result: data } });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h2>User Input</h2>
        <p className="subtext">Set your requirements below to generate a compatible custom build.</p>
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit} className="form">
          <div className="two-col">
            <label>
              Minimum Budget
              <input
                type="number"
                min={1}
                value={budgetMin}
                onChange={(event) => setBudgetMin(event.target.value)}
                required
              />
            </label>

            <label>
              Maximum Budget
              <input
                type="number"
                min={1}
                value={budgetMax}
                onChange={(event) => setBudgetMax(event.target.value)}
                required
              />
            </label>
          </div>

          <fieldset>
            <legend>Usage</legend>
            <div className="chip-grid">
              {usageOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${usage === option ? "chip-active" : ""}`}
                  onClick={() => setUsage(option)}
                >
                  {toTitleCase(option)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Priority Components</legend>
            <p className="subtext">Select one or more component categories to prioritize.</p>
            <div className="chip-grid">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`chip ${selectedPriorities.includes(category) ? "chip-active" : ""}`}
                  onClick={() => togglePriority(category)}
                  onMouseEnter={(event) =>
                    setPriorityTooltip({
                      category,
                      x: event.clientX,
                      y: event.clientY
                    })
                  }
                  onMouseMove={(event) =>
                    setPriorityTooltip({
                      category,
                      x: event.clientX,
                      y: event.clientY
                    })
                  }
                  onMouseLeave={() => setPriorityTooltip(null)}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="subtext">Hover over a component to see how it affects your custom PC.</p>
          </fieldset>

          <fieldset>
            <legend>Optional Brand Preference</legend>
            <p className="subtext">Choose a preferred brand per component. Leave blank if no preference.</p>
            <div className="brand-pref-grid">
              {categoryOptions.map((category) => (
                <label key={category}>
                  {category}
                  <select
                    value={brandPreferences[category] || ""}
                    onChange={(event) =>
                      setBrandPreferences((prev) => ({
                        ...prev,
                        [category]: event.target.value
                      }))
                    }
                  >
                    <option value="">No preference</option>
                    {(componentCatalog[category] || []).map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="generate-button"
            disabled={!canSubmit || loading}
            title={!canSubmit ? "Complete required fields to enable Generate Build" : "Generate your custom PC build"}
          >
            {loading ? "Generating..." : "Generate Build"}
          </button>

          {!canSubmit && (
            <p className="disabled-note">
              Generate Build is disabled until budget, usage, and at least one priority component are completed.
            </p>
          )}
        </form>
      </section>

      {priorityTooltip && (
        <div
          className="priority-tooltip floating"
          style={{
            left: `${priorityTooltip.x + 14}px`,
            top: `${priorityTooltip.y + 14}px`
          }}
        >
          <strong>{priorityTooltip.category}</strong>: {priorityComponentInfo[priorityTooltip.category]}
        </div>
      )}
    </main>
  );
}

function BuildResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as { result?: GenerateBuildResponse } | null)?.result;
  const buildEntries = Object.entries(result?.build ?? {});
  const totalPrice = buildEntries.reduce((total, [, component]) => total + component.price, 0);

  if (!result) {
    return (
      <main className="page">
        <section className="card">
          <h2>No Build Result Found</h2>
          <p className="subtext">Please submit the user input form first.</p>
          <button type="button" onClick={() => navigate("/user-input")}>
            Go to User Input
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Generated Custom PC Build</h2>
        <p className="subtext">{result.message}</p>

        {result.issues && result.issues.length > 0 && (
          <div>
            <p className="error">Compatibility issues found:</p>
            <ul>
              {result.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {result.build && (
          <>
            <p className="subtext">
              Selected components: <strong>{buildEntries.length}</strong> | Total price:{" "}
              <strong>PHP {totalPrice}</strong>
            </p>
          <ul className="build-list">
            {buildEntries.map(([category, component]) => (
              <li key={category}>
                <strong>{category}</strong>: {component.name} ({component.brand}) - PHP {component.price}
              </li>
            ))}
          </ul>
          </>
        )}

        <button type="button" onClick={() => navigate("/user-input")}>
          Build Again
        </button>
      </section>
    </main>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main>
      <section className="hero-shell">
        <div className="top-row">
          <div className="brand">
            <img src={logoImage} alt="SmartBuild logo" className="brand-logo-image" />
            <h1 className="brand-title">
              <span className="brand-smart">Smart</span>
              <span className="brand-build">Build</span>
            </h1>
          </div>
          <p className="top-pill">Random Forest decision support for custom PC recommendations</p>
        </div>

        <div className="hero-grid">
          <article className="hero-card">
            <h1 className="hero-title">Build a PC that fits your needs - and your budget.</h1>
            <p className="hero-copy">
              SmartBuild recommends a custom PC build based on your budget, usage, and priority
              components. It also checks compatibility automatically as part of the recommendation.
            </p>

            <h3 className="hero-question">Want help building a new pc?</h3>
            <div className="hero-actions">
              <button className="hero-button-start" type="button" onClick={() => navigate("/user-input")}>
                Start recommendation
              </button>
              <a className="hero-button-docs" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
                View API docs
              </a>
            </div>
          </article>

          <article className="hero-side-card">
            <h2>How it works</h2>
            <ul>
              <li>Enter min &amp; max budget</li>
              <li>Pick your usage (one choice)</li>
              <li>Select priority components</li>
              <li>(Optional) choose brand preferences</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/user-input" element={<UserInputPage />} />
        <Route path="/build-result" element={<BuildResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
