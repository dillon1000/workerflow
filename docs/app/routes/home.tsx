import type { Route } from './+types/home';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';
import '@fontsource/ibm-plex-serif/400-italic.css';
import '@fontsource/ibm-plex-serif/500-italic.css';
import '../components/landing/landing.css';

import { TopBar } from '../components/landing/TopBar';
import { Hero } from '../components/landing/Hero';
import { Modularity } from '../components/landing/Modularity';
import { Agents } from '../components/landing/Agents';
import { Integrations } from '../components/landing/Integrations';
import { CTA } from '../components/landing/CTA';
import { Footer } from '../components/landing/Footer';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Workerflow — the Cloudflare-native workflow editor' },
    {
      name: 'description',
      content:
        "A canvas for the automations you'd otherwise stitch together with cron jobs, one-off scripts, and prayer.",
    },
  ];
}

export default function Home() {
  return (
    <div className="wf-landing">
      <TopBar />
      <main>
        <Hero />
        <Modularity />
        <Agents />
        <Integrations />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
