import { useNavigate } from "react-router-dom";
import logoImage from "../assets/brand/SmartBuild.png";

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

export default LandingPage;