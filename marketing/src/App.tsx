import {
  ArrowRight,
  Blocks,
  Bot,
  Cable,
  GitBranch,
  Play,
  ShieldCheck,
} from "lucide-react";

const featureRows = [
  {
    id: "01",
    title: "Design automation like a system diagram.",
    copy:
      "Build flows on a canvas, wire data between nodes, and keep the shape of the work visible instead of burying it in YAML or glue code.",
  },
  {
    id: "02",
    title: "Run on Cloudflare with durable execution.",
    copy:
      "Long-running workflows survive retries, waits, and external callbacks without turning your app into an orchestration project.",
  },
  {
    id: "03",
    title: "Ship integrations as transparent plugins.",
    copy:
      "Connections, triggers, tests, and runtime steps live in one folder-based plugin model so extending the platform stays auditable.",
  },
];

const capabilityCards = [
  {
    icon: Cable,
    title: "Reusable connections",
    copy: "Store provider credentials once and reuse them across any workflow.",
  },
  {
    icon: Bot,
    title: "AI-native steps",
    copy: "Mix prompts, structured outputs, images, and logic in the same run graph.",
  },
  {
    icon: ShieldCheck,
    title: "Verified triggers",
    copy: "Inbound GitHub and Linear webhooks verify signatures before execution begins.",
  },
  {
    icon: GitBranch,
    title: "Plugin-first runtime",
    copy: "New nodes are auto-discovered from plugin folders instead of hardcoded registries.",
  },
];

export default function App() {
  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Workerflow</p>
          <p className="topbar-title">Cloudflare-native workflow orchestration</p>
        </div>
        <nav className="topbar-links" aria-label="Primary">
          <a href="http://localhost:5174">Docs</a>
          <a href="http://localhost:5173">App</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Visual automation without the abstraction tax</p>
            <h1>
              Durable workflows, visible logic, and integrations that stay easy
              to reason about.
            </h1>
            <p className="hero-body">
              Workerflow gives teams a canvas for building real automations on
              Cloudflare. The editor stays visual, the runtime stays durable,
              and the integration model stays transparent.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="http://localhost:5174">
                Read the docs
                <ArrowRight size={16} />
              </a>
              <a className="secondary-link" href="http://localhost:5173">
                Open the product
              </a>
            </div>
          </div>

          <div className="hero-panel" aria-label="Workflow preview">
            <div className="panel-header">
              <span>Run blueprint</span>
              <span className="mono">workflow/github-triage</span>
            </div>
            <div className="hero-grid">
              <article className="hero-node trigger">
                <span className="node-kind">Trigger</span>
                <strong>GitHub webhook</strong>
                <p>Verify signature, normalize event payload.</p>
              </article>
              <article className="hero-node logic">
                <span className="node-kind">Logic</span>
                <strong>Condition branch</strong>
                <p>Route issue comments and pull request events separately.</p>
              </article>
              <article className="hero-node data">
                <span className="node-kind">AI</span>
                <strong>Summarize context</strong>
                <p>Convert noisy payloads into structured briefing text.</p>
              </article>
              <article className="hero-node action">
                <span className="node-kind">Action</span>
                <strong>Create Linear ticket</strong>
                <p>Open follow-up work only when triage rules are met.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Product qualities">
          <div>
            <Blocks size={16} />
            <span>Canvas editor</span>
          </div>
          <div>
            <Play size={16} />
            <span>Durable runs</span>
          </div>
          <div>
            <Cable size={16} />
            <span>Plugin integrations</span>
          </div>
        </section>

        <section className="feature-list">
          {featureRows.map((row) => (
            <article key={row.id} className="feature-row">
              <span className="feature-id mono">{row.id}</span>
              <h2>{row.title}</h2>
              <p>{row.copy}</p>
            </article>
          ))}
        </section>

        <section className="capabilities">
          <div className="section-heading">
            <p className="eyebrow">Operationally calm</p>
            <h2>Made for teams who want leverage, not mystery.</h2>
          </div>
          <div className="capability-grid">
            {capabilityCards.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="capability-card">
                <Icon size={18} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
