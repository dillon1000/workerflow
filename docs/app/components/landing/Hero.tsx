import { useEffect, useRef } from 'react';

export function Hero() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const annotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    const annot = annotRef.current;
    if (!stage || !svg) return;

    const edges = [
      { from: 'w-connect', to: 'w-automate', cls: 'e1', color: '#f48120', marker: 'url(#arrow-primary)' },
      { from: 'w-automate', to: 'w-run', cls: 'e2', color: '#0e0e0d', marker: 'url(#arrow-ink)' },
    ];

    function anchor(el: HTMLElement, side: 'in' | 'out') {
      const stageBox = stage!.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const y = b.top - stageBox.top + b.height / 2;
      const x = side === 'out' ? b.right - stageBox.left : b.left - stageBox.left;
      return { x, y };
    }

    function smoothstep(a: { x: number; y: number }, b: { x: number; y: number }) {
      const r = 8;
      const stub = 14;
      const ax = a.x + stub;
      const bx = b.x - stub;
      const midX = (ax + bx) / 2;
      if (Math.abs(a.y - b.y) < 2) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
      const goingDown = b.y > a.y;
      const rY = goingDown ? r : -r;
      return [
        `M ${a.x} ${a.y}`,
        `L ${midX - r} ${a.y}`,
        `Q ${midX} ${a.y} ${midX} ${a.y + rY}`,
        `L ${midX} ${b.y - rY}`,
        `Q ${midX} ${b.y} ${midX + r} ${b.y}`,
        `L ${b.x} ${b.y}`,
      ].join(' ');
    }

    function draw() {
      if (!svg || !stage) return;
      const defs = svg.querySelector('defs');
      // Remove only dynamically-added paths, keep defs
      Array.from(svg.querySelectorAll('path.wf-edge-path')).forEach((n) => n.remove());
      const stageBox = stage.getBoundingClientRect();
      svg.setAttribute('width', String(stageBox.width));
      svg.setAttribute('height', String(stageBox.height));

      edges.forEach((e) => {
        const src = document.getElementById(e.from);
        const tgt = document.getElementById(e.to);
        if (!src || !tgt) return;
        const a = anchor(src, 'out');
        const b = anchor(tgt, 'in');
        const d = smoothstep(a, b);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', e.color);
        path.setAttribute('stroke-width', '1.6');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('marker-end', e.marker);
        path.setAttribute('class', 'wf-edge-path ' + e.cls);
        svg.appendChild(path);
        // keep defs last-or-first is fine; marker still referenced
        if (defs && svg.firstChild !== defs) svg.insertBefore(defs, svg.firstChild);
      });

      const connect = document.getElementById('w-connect');
      if (connect && annot) {
        const sb = stage.getBoundingClientRect();
        const cb = connect.getBoundingClientRect();
        annot.style.left = cb.left - sb.left + 8 + 'px';
        annot.style.top = cb.top - sb.top - 28 + 'px';
      }
    }

    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    const t1 = setTimeout(draw, 140);
    const t2 = setTimeout(draw, 480);
    const t3 = setTimeout(draw, 900);

    // Parallax
    const hero = stage.closest('.wf-hero') as HTMLElement | null;
    const nodes = hero ? hero.querySelectorAll<HTMLElement>('.wf-word-node') : [];
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (!hero) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        nodes.forEach((n, i) => {
          const base = parseFloat(getComputedStyle(n).getPropertyValue('--y-offset')) || 0;
          const depth = ((i % 3) + 1) * 1.4;
          n.style.transform = `translate(${nx * depth}px, calc(${base}px + ${ny * depth}px))`;
        });
      });
    };
    const onLeave = () => nodes.forEach((n) => (n.style.transform = ''));
    if (hero) {
      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', onLeave);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (hero) {
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('mouseleave', onLeave);
      }
    };
  }, []);

  return (
    <section id="hero" className="wf-hero">
      <div className="wf-hero-coord">
        <span className="live"><span className="dot"></span>canvas / live</span>
        <span>3 nodes</span>
        <span className="dim">·</span>
        <span>2 edges</span>
        <span className="dim">· main.workflow.ts</span>
        <span className="spacer"></span>
        <span className="dim">⌘ K to open node library</span>
      </div>

      <div className="wf-title-stage" ref={stageRef}>
        <svg className="wf-title-svg" ref={svgRef} aria-hidden="true">
          <defs>
            <marker id="arrow-primary" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f48120"/>
            </marker>
            <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0e0e0d"/>
            </marker>
          </defs>
        </svg>

        <div className="wf-annot" ref={annotRef}>
          <span className="dot"></span>trigger · github:issue.opened
        </div>

        <div className="wf-title-line">
          <div className="wf-word-node" data-family="trigger" id="w-connect" data-delay="0" style={{ ['--y-offset' as never]: '-34px' }}>
            <span className="wf-handle target" aria-hidden="true"></span>
            <div className="wf-word-node-head">
              <span className="sw" style={{ background: 'var(--family-trigger)' }}></span>
              <span className="fam">trigger</span>
              <span className="st running">
                <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.55"/></svg>
                running
              </span>
            </div>
            <div className="wf-word-node-body">
              <div className="wf-word-node-text upright">Connect</div>
            </div>
            <span className="wf-handle source" aria-hidden="true"></span>
          </div>

          <div className="wf-word-node" data-family="action" id="w-automate" data-delay="1" style={{ ['--y-offset' as never]: '28px' }}>
            <span className="wf-handle target" aria-hidden="true"></span>
            <div className="wf-word-node-head">
              <span className="sw" style={{ background: 'var(--family-action)' }}></span>
              <span className="fam">action</span>
              <span className="st done">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                done
              </span>
            </div>
            <div className="wf-word-node-body">
              <div className="wf-word-node-text">Automate</div>
            </div>
            <span className="wf-handle source" aria-hidden="true"></span>
          </div>

          <div className="wf-word-node" data-family="data" id="w-run" data-delay="2" style={{ ['--y-offset' as never]: '-12px' }}>
            <span className="wf-handle target" aria-hidden="true"></span>
            <div className="wf-word-node-head">
              <span className="sw" style={{ background: 'var(--family-data)' }}></span>
              <span className="fam">data</span>
              <span className="st done">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                done
              </span>
            </div>
            <div className="wf-word-node-body">
              <div className="wf-word-node-text upright">Run.</div>
            </div>
            <span className="wf-handle source" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div className="wf-rf-controls" aria-hidden="true">
        <button title="zoom in"><svg viewBox="0 0 12 12"><rect x="5" y="1" width="2" height="10"/><rect x="1" y="5" width="10" height="2"/></svg></button>
        <button title="zoom out"><svg viewBox="0 0 12 12"><rect x="1" y="5" width="10" height="2"/></svg></button>
        <button title="fit view"><svg viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4"/><rect x="4" y="4" width="4" height="4"/></svg></button>
      </div>

      <div className="wf-hero-foot">
        <p className="wf-hero-lede">
          <span className="kicker">workerflow · cloudflare-native</span>
          A canvas for the automations you'd otherwise stitch together with cron jobs, one-off scripts, and prayer. Compose the nodes you need, reference the credentials you already have, ship to <em>your</em> Cloudflare account.
        </p>
        <div className="wf-hero-cta">
          <a className="btn btn-lg btn-outline" href="https://github.com/dillon1000/workerflow" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z"/></svg>
            Read the source
          </a>
          <a className="btn btn-lg btn-primary" href="#start">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            New workflow
          </a>
        </div>
      </div>
    </section>
  );
}
