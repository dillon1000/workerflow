export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="wf-footer">
      <div className="wf-footer-row">
        <span>© {year} Workerflow</span>
        <span className="sep"></span>
        <span>MIT licensed</span>
        <span className="sep"></span>
        <span>Built on Cloudflare Workers</span>
        <span className="right">
          <a href="https://github.com/dillon1000/workerflow" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/docs">Docs</a>
          <a href="#">Changelog</a>
        </span>
      </div>
    </footer>
  );
}
