import { useNavigate, useLocation } from "react-router-dom";

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

export default BuildResultPage;