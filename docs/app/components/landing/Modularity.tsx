export function Modularity() {
  return (
    <section id="modularity" className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="section-kicker">§ 01 — Modularity</span>
          <h2 className="section-title">Every node is a <em>module</em>.<br />Every module is yours.</h2>
          <p className="section-sub">Workerflow is built around composition — small, swappable pieces you can wire together, rearrange, or replace without touching the runtime.</p>
        </div>

        <div className="mod-grid stagger">
          <div className="mod">
            <div className="mod-head">
              <span className="mod-num">01</span>
              <span className="mod-tag">compose</span>
            </div>
            <h3>All together<br />now.</h3>
            <p>Triggers, actions, logic, and data nodes are the only primitives. Drop them on the canvas, connect the handles, and you have a workflow — no configuration files, no code to write, no framework to learn.</p>
            <div className="mod-viz viz-stack" aria-hidden="true">
              <div className="viz-row">
                <span className="sw" style={{ background: 'var(--family-trigger)' }}></span>
                webhook.receive
                <span className="sub">trigger</span>
              </div>
              <div className="viz-row">
                <span className="sw" style={{ background: 'var(--family-action)' }}></span>
                github.openIssue
                <span className="sub">action</span>
              </div>
              <div className="viz-row">
                <span className="sw" style={{ background: 'var(--family-logic)' }}></span>
                branch.if
                <span className="sub">logic</span>
              </div>
              <div className="viz-row dashed">
                <span className="sw" style={{ background: 'var(--color-border-strong)' }}></span>
                drop another node…
                <span className="sub">+</span>
              </div>
            </div>
          </div>

          <div className="mod">
            <div className="mod-head">
              <span className="mod-num">02</span>
              <span className="mod-tag">nest</span>
            </div>
            <h3>Workflows<br />inside workflows.</h3>
            <p>Any graph can be invoked as a node in another graph. Build a <span className="k">triage</span> flow once, then call it from <span className="k">on-issue</span>, <span className="k">on-pr</span>, and <span className="k">daily-report</span> — the same way you'd call a function.</p>
            <div className="mod-viz" aria-hidden="true">
              <div className="mini-canvas">
                <div className="mini-node" style={{ top: 14, left: 14 }}>
                  <span className="sw" style={{ background: 'var(--family-trigger)' }}></span>on:issue
                </div>
                <div className="mini-node" style={{ top: 14, right: 14, borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' }}>
                  <span className="sw" style={{ background: 'var(--color-primary)' }}></span>triage()
                </div>
                <div className="mini-node" style={{ bottom: 14, left: '50%', transform: 'translateX(-50%)' }}>
                  <span className="sw" style={{ background: 'var(--family-action)' }}></span>notify.ops
                </div>
                <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <path d="M 100 28 L 260 28" stroke="#f48120" strokeWidth={1.3} fill="none" markerEnd="url(#mini-arrow)" />
                  <path d="M 320 46 Q 320 90 220 100" stroke="#cfccc3" strokeWidth={1.2} fill="none" strokeDasharray="3 3" />
                  <defs>
                    <marker id="mini-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0 0 L10 5 L0 10 z" fill="#f48120" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          <div className="mod">
            <div className="mod-head">
              <span className="mod-num">03</span>
              <span className="mod-tag">reuse</span>
            </div>
            <h3>This connection<br />is mine.</h3>
            <p>Store a provider credential once. Reference it by handle — <span className="k">conn:github/main</span> — from anywhere in any workflow. Rotate the token in one place and every node picks it up.</p>
            <div className="mod-viz viz-manifest" aria-hidden="true">
              <div className="line"><span className="g">●</span><span>connections/</span></div>
              <div className="line n"><span className="g">├─</span><span>github/main <span className="c">· token</span></span></div>
              <div className="line"><span className="g">├─</span><span>linear/ops <span className="c">· api-key</span></span></div>
              <div className="line"><span className="g">├─</span><span>webhook/stripe <span className="c">· signing-key</span></span></div>
              <div className="line"><span className="g">└─</span><span style={{ color: 'var(--color-muted-foreground)' }}>+ add connection</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
