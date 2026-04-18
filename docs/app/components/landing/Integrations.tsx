export function Integrations() {
  return (
    <section id="integrations" className="integrations">
      <div className="integ-row">
        <div className="integ-label">
          available today
          <em>Your integrations, wired in.</em>
        </div>
        <div className="integ-chips">
          <span className="chip"><span className="ic" style={{ background: '#0e0e0d' }}><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z"/></svg></span>GitHub</span>
          <span className="chip"><span className="ic" style={{ background: '#5e6ad2' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg></span>Linear</span>
          <span className="chip"><span className="ic" style={{ background: '#f48120' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 18a5 5 0 1 0-4.5-8.5"/><path d="M17.5 18H7a5 5 0 0 1 0-10 6 6 0 0 1 11.7 1.2"/></svg></span>Workers AI</span>
          <span className="chip"><span className="ic" style={{ background: '#3b6e4d' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17"/><path d="m6 17 3.13-5.78"/><path d="m12 6 3.13 5.73"/></svg></span>Webhooks</span>
          <span className="chip"><span className="ic" style={{ background: '#7a6c5a' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/></svg></span>Schedule</span>
          <span className="chip"><span className="ic" style={{ background: '#0e0e0d' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>HTTP</span>
          <span className="chip"><span className="ic" style={{ background: '#b42318' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10M12 7v10"/></svg></span>Button</span>
          <span className="chip dashed">
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg></span>
            write your own
          </span>
        </div>
      </div>
    </section>
  );
}
