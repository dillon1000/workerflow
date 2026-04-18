import { Link } from 'react-router';
import { FullSearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger';

const GITHUB_URL = 'https://github.com/dillon1000/workerflow';

export function TopBar() {
  return (
    <header className="wf-topbar page-reveal">
      <a className="wf-brand" href="#hero">
        <img className="wf-brand-mark" src="/workerflow-logo.png" alt="" width={18} height={18} aria-hidden="true" />
        <span className="wf-brand-name">workerflow</span>
      </a>
      <nav className="wf-topnav" aria-label="primary">
        <a href="#hero" className="active">Overview</a>
        <a href="#modularity">Build</a>
        <a href="#agents">Agents</a>
        <a href="#integrations">Connections</a>
        <Link to="/docs">Docs</Link>
      </nav>
      <div className="wf-topbar-right">
        <FullSearchTrigger className="wf-search-trigger" hideIfDisabled />
        <Link className="btn btn-sm btn-outline" to="/docs">Docs</Link>
        <a className="btn btn-sm btn-primary" href={GITHUB_URL} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z"/></svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
