export function CTA() {
  return (
    <section id="start" className="section-pad cta-wrap">
      <div className="container">
        <div className="cta">
          <div>
            <h2>Bring your graph.<br /><em>Ship it on your own infra.</em></h2>
            <p>Open source. Cloudflare-native. Every workflow you build runs on your account, under your bindings — no middle layer, no per-run billing from us.</p>
            <div className="cta-actions">
              <a className="btn btn-lg btn-primary" href="#">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Self-host it
              </a>
              <a className="btn btn-lg btn-outline" href="https://github.com/dillon1000/workerflow" target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" /></svg>
                dillon1000/workerflow
              </a>
            </div>
          </div>
          <div className="code-card">
            <div className="code-head">
              <span className="dots"><span></span><span></span><span></span></span>
              <span>zsh · ~/workerflow</span>
              <span className="tab">local</span>
            </div>
            <div className="code-body">
              <span className="prompt">$</span> <span className="c-var">git</span> clone dillon1000/workerflow
              {'\n'}
              <span className="prompt">$</span> <span className="c-var">cp</span> .env.example .env
              {'\n'}
              <span className="prompt">$</span> <span className="c-var">pnpm</span> install
              {'\n'}
              <span className="c-com">{'  added 342 packages · 4.1s'}</span>
              {'\n'}
              <span className="prompt">$</span> <span className="c-var">pnpm</span> dev
              {'\n'}
              <span className="c-com">{'  ▲ vite · hono · drizzle'}</span>
              {'\n'}
              <span className="c-com">{'  ✓ http://localhost:5173'}</span>
              {'\n'}
              <span className="prompt">$</span> <span className="c-var">_</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
