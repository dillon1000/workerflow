export function Agents() {
  return (
    <section id="agents" className="section-pad agents-wrap">
      <div className="container">
        <div className="section-head">
          <span className="section-kicker">§ 02 — AI Authoring</span>
          <h2 className="section-title">Describe the workflow.<br />Let the canvas <em>draw itself</em>.</h2>
          <p className="section-sub">An AI copilot built into the editor — it reads your connections and custom nodes, proposes graphs from plain English, and refactors what's already there.</p>
        </div>

        <div className="agents-grid">
          <div className="agents-copy">
            <ul className="fact-list">
              <li className="fact">
                <span className="fact-num mono">A</span>
                <div>
                  <h4>Type what you want.</h4>
                  <p>"When a Stripe webhook fires, classify it, open a Linear ticket if it's a dispute." The copilot lays down the nodes, wires the edges, and fills the fields using <span className="k">conn:stripe</span> and <span className="k">conn:linear/ops</span> you already have.</p>
                </div>
              </li>
              <li className="fact">
                <span className="fact-num mono">B</span>
                <div>
                  <h4>Refactor by selection.</h4>
                  <p>Lasso a subgraph, ask <span className="k">/simplify</span> or <span className="k">/add retry</span>. The copilot returns a visual diff — new nodes tinted green, removed ones dimmed — that you accept, tweak, or throw away.</p>
                </div>
              </li>
              <li className="fact">
                <span className="fact-num mono">C</span>
                <div>
                  <h4>Grounded in your canvas.</h4>
                  <p>The copilot sees your connection handles, custom node library, and prior runs. Suggestions reference <span className="k">your</span> primitives — not a hallucinated API.</p>
                </div>
              </li>
            </ul>

            <div className="agents-actions">
              <a className="btn btn-lg btn-primary" href="#docs">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.09 6.26L20 11l-5.91 1.74L12 19l-2.09-6.26L4 11l5.91-1.74z" /></svg>
                Try the copilot
              </a>
              <a className="btn btn-lg btn-outline" href="#docs">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h6M7 16h4" /></svg>
                Prompt recipes
              </a>
            </div>
          </div>

          <div className="compose" aria-hidden="true">
            <div className="compose-head">
              <span className="dot dot-1"></span>
              <span className="dot dot-2"></span>
              <span className="dot dot-3"></span>
              <span className="ch-title">workerflow · copilot</span>
              <span className="ch-status"><span className="live-dot"></span>ready</span>
            </div>

            <div className="prompt-row">
              <span className="prompt-glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.09 6.26L20 11l-5.91 1.74L12 19l-2.09-6.26L4 11l5.91-1.74z" /></svg>
              </span>
              <div className="prompt-text">
                When a Stripe <span className="tok">charge.dispute</span> fires, classify it, open a Linear ticket, and notify <span className="tok">#ops</span>.<span className="prompt-caret"></span>
              </div>
              <span className="prompt-kbd">⌘ ⏎</span>
            </div>

            <div className="plan">
              <div className="plan-head">
                <span className="pl-label">plan</span>
                <span className="pl-sep">·</span>
                <span className="pl-stat"><span className="pl-dot added"></span>4 nodes</span>
                <span className="pl-stat"><span className="pl-dot edge"></span>3 edges</span>
                <span className="pl-spacer"></span>
                <span className="pl-accept">accept ↵</span>
              </div>

              <div className="plan-body">
                <div className="plan-row added">
                  <span className="pr-sign">+</span>
                  <span className="sw" style={{ background: 'var(--family-trigger)' }}></span>
                  <span className="pr-name">stripe.webhook</span>
                  <span className="pr-meta">conn:stripe · filter: charge.dispute</span>
                </div>
                <div className="plan-row added">
                  <span className="pr-sign">+</span>
                  <span className="sw" style={{ background: 'var(--color-primary)' }}></span>
                  <span className="pr-name">agent.classify <span className="pr-chip">claude</span></span>
                  <span className="pr-meta">→ category, severity</span>
                </div>
                <div className="plan-row added">
                  <span className="pr-sign">+</span>
                  <span className="sw" style={{ background: 'var(--family-action)' }}></span>
                  <span className="pr-name">linear.createTicket</span>
                  <span className="pr-meta">conn:linear/ops · team: billing</span>
                </div>
                <div className="plan-row added">
                  <span className="pr-sign">+</span>
                  <span className="sw" style={{ background: 'var(--family-action)' }}></span>
                  <span className="pr-name">slack.notify</span>
                  <span className="pr-meta">channel: #ops</span>
                </div>
                <div className="plan-row dim">
                  <span className="pr-sign">·</span>
                  <span className="pr-note">edges: webhook → classify → ticket → notify</span>
                </div>
              </div>

              <div className="plan-canvas">
                <svg viewBox="0 0 420 110" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <defs>
                    <marker id="cp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0 0 L10 5 L0 10 z" fill="#f48120" />
                    </marker>
                  </defs>
                  <path d="M 70 38 L 140 38" stroke="#f48120" strokeWidth={1.3} fill="none" markerEnd="url(#cp-arrow)" className="cp-edge cp-e1" />
                  <path d="M 210 38 L 280 38" stroke="#f48120" strokeWidth={1.3} fill="none" markerEnd="url(#cp-arrow)" className="cp-edge cp-e2" />
                  <path d="M 320 54 Q 320 90 210 90" stroke="#cfccc3" strokeWidth={1.2} fill="none" strokeDasharray="3 3" className="cp-edge cp-e3" />
                </svg>
                <div className="cp-node cp-n1" style={{ top: 24, left: 14 }}>
                  <span className="sw" style={{ background: 'var(--family-trigger)' }}></span>stripe.webhook
                </div>
                <div className="cp-node cp-n2" style={{ top: 24, left: 148 }}>
                  <span className="sw" style={{ background: 'var(--color-primary)' }}></span>classify
                </div>
                <div className="cp-node cp-n3" style={{ top: 24, right: 14 }}>
                  <span className="sw" style={{ background: 'var(--family-action)' }}></span>linear.ticket
                </div>
                <div className="cp-node cp-n4" style={{ bottom: 14, left: '50%', transform: 'translateX(-50%)' }}>
                  <span className="sw" style={{ background: 'var(--family-action)' }}></span>slack.notify
                </div>
              </div>
            </div>

            <div className="compose-foot">
              <span>4 new · 0 changed · 0 removed</span>
              <span className="foot-spacer"></span>
              <span>grounded in 6 connections</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
