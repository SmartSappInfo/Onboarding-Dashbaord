'use client';

import * as React from 'react';
import type { CampaignPage } from '@/lib/types';

interface GoalPreviewProps {
  goal: CampaignPage['pageGoal'];
  /** Hex color from page.settings.themeOverrides?.primary */
  themeColor?: string;
  pageName?: string;
}

// ─── Individual Goal Layouts ──────────────────────────────────────────────────
// Each is a 900px-wide div rendered inside a scaled container.
// They reference var(--accent) so theme color applies without Tailwind JIT dynamic classes.

function LeadCaptureLayout({ pageName }: { pageName: string }) {
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0f0c29 100%)',
      minHeight: '100%',
      color: 'white',
      padding: '0',
    }}>
      {/* Nav */}
      <div style={{ padding: '16px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>SmartSapp</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Features</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Pricing</span>
          <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: 'white', padding: '5px 14px', borderRadius: 7 }}>Get Started</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '56px 36px 40px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: '1.2' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 100, padding: '4px 14px', fontSize: 10, fontWeight: 700, color: '#c084fc', marginBottom: 20 }}>
            🚀 Platform now live
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.05, marginBottom: 16, background: `linear-gradient(135deg, #fff 30%, var(--accent) 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Grow Smarter,<br />Not Harder.
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 28, maxWidth: 380 }}>
            The complete client onboarding suite for high-growth teams. Automate workflows and delight every client from day one.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '11px 16px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Enter your work email...
            </div>
            <div style={{ background: 'var(--accent)', borderRadius: 10, padding: '11px 22px', color: 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Get Access →
            </div>
          </div>
          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            {['#f59e0b', '#6366f1', '#10b981', '#ec4899'].map((c, i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid #0f0c29', marginLeft: i > 0 ? -8 : 0 }} />
            ))}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>Join 5,000+ teams</span>
          </div>
        </div>

        {/* Widget */}
        <div style={{ flex: 1 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Live Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['12.4k', 'Visitors'], ['3.1k', 'Leads'], ['25%', 'Conv.'], ['$4.2', 'CPA']].map(([v, l], i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: i === 1 ? '#a78bfa' : i === 2 ? '#34d399' : i === 3 ? '#fbbf24' : 'white' }}>{v}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4, textTransform: 'uppercase' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Goal</div>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ width: '72%', height: '100%', background: 'var(--accent)', borderRadius: 100 }} />
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>72%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistrationLayout({ pageName }: { pageName: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: 'white', minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 17, fontWeight: 900 }}>SmartSapp</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>Already have an account? <strong>Log in</strong></span>
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Left */}
        <div style={{ flex: 1, padding: '44px 36px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            ✓ Free forever · No credit card
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginBottom: 14 }}>Join 5,000+<br />Growing Teams</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            Automate your onboarding and deliver white-glove client experiences from day one.
          </div>
          {['Set up in under 5 minutes', 'Unlimited workspace members', 'Dedicated onboarding support'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#475569', marginBottom: 11 }}>
              <div style={{ width: 20, height: 20, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              {item}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {['G2 ★ 4.9', 'SOC 2', 'GDPR'].map((badge, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: 7 }}>{badge}</div>
            ))}
          </div>
        </div>
        {/* Right */}
        <div style={{ width: 300, background: 'var(--accent)', padding: '44px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 18, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Create your account</div>
            {['Full Name', 'Work Email', 'Company'].map((label, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <div style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#94a3b8' }}>
                  {label === 'Full Name' ? 'Your full name' : label === 'Work Email' ? 'name@company.com' : 'Company name'}
                </div>
              </div>
            ))}
            <div style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: 11, color: 'white', fontSize: 12, fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
              Create Free Account →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InformationLayout({ pageName }: { pageName: string }) {
  const tiles = [
    { title: 'Automate Onboarding End-to-End', desc: 'From first contact to fully onboarded — every touchpoint managed with smart automation and AI-powered workflows.', wide: true, color: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.2)', icon: '#a78bfa' },
    { title: 'Smart Scheduling', desc: 'Reduce no-shows by 68%.', wide: false, color: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.18)', icon: '#34d399' },
    { title: 'Analytics', desc: 'Full lifecycle insights.', wide: false, color: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.18)', icon: '#fbbf24' },
    { title: 'Client Portals', desc: 'White-labeled experiences.', wide: false, color: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', icon: '#f87171' },
    { title: 'Messaging', desc: 'Email, SMS, campaigns.', wide: false, color: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.18)', icon: '#a78bfa' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', minHeight: '100%', color: 'white' }}>
      <div style={{ padding: '15px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontSize: 16, fontWeight: 900 }}>SmartSapp</span>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Platform</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Pricing</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: 'white', padding: '5px 14px', borderRadius: 7 }}>Start Free</span>
        </div>
      </div>
      <div style={{ padding: '28px 36px 0', fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Complete Platform Overview
      </div>
      <div style={{ padding: '10px 36px 24px', fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>
        Everything your team needs<br />to onboard at scale.
      </div>
      <div style={{ padding: '0 36px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, height: 260 }}>
        {tiles.map((tile, i) => (
          <div key={i} style={{ gridColumn: tile.wide ? 'span 2' : undefined, background: tile.color, border: `1px solid ${tile.border}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: tile.wide ? 18 : 13, fontWeight: 700, marginBottom: 5, color: 'white' }}>{tile.title}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{tile.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 36px 24px', display: 'flex', gap: 10 }}>
        <div style={{ background: 'var(--accent)', borderRadius: 10, padding: '12px 28px', color: 'white', fontSize: 13, fontWeight: 700 }}>Start for Free →</div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 24px', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>Watch Demo</div>
      </div>
    </div>
  );
}

function PaymentLayout({ pageName }: { pageName: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 36px' }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.1)', padding: 36, border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Professional Plan</div>
          <div style={{ fontSize: 56, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>$49<span style={{ fontSize: 18, color: '#64748b', fontWeight: 500 }}>/mo</span></div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Everything you need to scale</div>
        </div>
        {['Unlimited workspaces', 'Custom domain', 'Priority support', 'Advanced analytics', 'Team collaboration'].map((feat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#475569', marginBottom: 12 }}>
            <div style={{ width: 20, height: 20, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            {feat}
          </div>
        ))}
        <div style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '14px', color: 'white', fontSize: 14, fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
          Start 14-Day Free Trial →
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 12 }}>No credit card required</div>
      </div>
    </div>
  );
}

function ThankYouLayout({ pageName }: { pageName: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 36px', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 0 40px rgba(99,102,241,0.3)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginBottom: 16, color: '#0f172a' }}>
        You're all set!
      </div>
      <div style={{ fontSize: 16, color: '#64748b', lineHeight: 1.6, maxWidth: 460, marginBottom: 40 }}>
        Thanks for signing up. Your account is ready and your onboarding journey begins now.
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <div style={{ background: 'var(--accent)', borderRadius: 12, padding: '13px 28px', color: 'white', fontSize: 13, fontWeight: 700 }}>
          Go to Dashboard →
        </div>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 24px', color: '#475569', fontSize: 13, fontWeight: 600 }}>
          View Resources
        </div>
      </div>
      <div style={{ display: 'flex', gap: 32, marginTop: 56, padding: '24px 40px', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        {[['5,000+', 'Teams'], ['99.9%', 'Uptime'], ['4.9 ★', 'G2 Rating']].map(([v, l], i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{v}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Layout Map ───────────────────────────────────────────────────────────────

const GOAL_LAYOUTS: Record<CampaignPage['pageGoal'], React.ComponentType<{ pageName: string }>> = {
  lead_capture:  LeadCaptureLayout,
  registration:  RegistrationLayout,
  information:   InformationLayout,
  payment:       PaymentLayout,
  thank_you:     ThankYouLayout,
};

// ─── GoalPreview ──────────────────────────────────────────────────────────────

export const GoalPreview = React.memo(function GoalPreview({
  goal,
  themeColor = '#6366f1',
  pageName = 'Campaign Page',
}: GoalPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const innerRef     = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    const inner     = innerRef.current;
    if (!container || !inner) return;

    // Risk 5 — SSR guard: ResizeObserver is browser-only
    if (typeof ResizeObserver === 'undefined') return;

    const applyScale = (w: number, h: number) => {
      const scale = w / 900;
      inner.style.transform       = `scale(${scale})`;
      inner.style.transformOrigin = 'top left';
      inner.style.width           = '900px';
      inner.style.height          = `${h / scale}px`;
    };

    // Set initial scale immediately
    applyScale(container.offsetWidth, container.offsetHeight);

    // Risk 9 — requestAnimationFrame throttles to one recalc per frame
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      requestAnimationFrame(() => applyScale(width, height));
    });

    observer.observe(container);

    // Risk 2 — always disconnect to prevent memory leaks
    return () => observer.disconnect();
  }, []); // stable — no deps needed since we read from refs

  const Layout = GOAL_LAYOUTS[goal] ?? LeadCaptureLayout;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      // Risk 5 — theme color as CSS custom property (not Tailwind dynamic class)
      style={{ '--accent': themeColor } as React.CSSProperties}
    >
      <div ref={innerRef} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Layout pageName={pageName} />
      </div>
    </div>
  );
});

GoalPreview.displayName = 'GoalPreview';
