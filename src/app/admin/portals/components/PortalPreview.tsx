'use client';

import * as React from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PortalPreviewProps {
  kind: 'survey' | 'pdf' | 'meeting' | 'custom';
  title: string;
  description?: string;
  entityName?: string;
  logoUrl?: string;
  backgroundColor?: string;
  meetingTime?: string;
  questionCount?: number;
  fieldCount?: number;
  themeColor?: string;
  /** For custom pages — maps to a page-specific faithful layout */
  pageKey?: string;
}

// ─── CUSTOM PAGE LAYOUTS (faithful HTML/CSS recreations) ─────────────────────

/** Public Homepage — dark bg, SmartSapp nav, video hero */
function HomepageLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#09090f', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#09090f"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.3px' }}>SmartSapp</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91"/></svg>
            Call/WhatsApp +233 50 162 6873
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, background: '#3B5FFF', color: 'white', padding: '5px 12px', borderRadius: 7 }}>Download App</div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '32px 28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginBottom: 14, background: 'linear-gradient(135deg, #3B5FFF 0%, #7C3AED 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Welcome to the<br />SmartSapp Family
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 6 }}>
          Your child's school has signed up on SmartSapp.<br />
          Here is a quick video to help you understand what it means for you as a parent.
        </div>
        <div style={{ fontSize: 10, fontWeight: 900, color: 'white', marginBottom: 18 }}>
          Please watch the full video. It's super important!
        </div>
        {/* Video thumbnail */}
        <div style={{ position: 'relative', background: '#f5c800', borderRadius: 14, overflow: 'hidden', margin: '0 auto', maxWidth: 520, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', boxShadow: '0 8px 32px rgba(59,95,255,0.25)' }}>
          {/* Stop sign */}
          <div style={{ position: 'absolute', left: '30%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ background: 'red', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'white' }}>STOP</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'darkred' }}>Parents</span>
          </div>
          {/* Text overlay */}
          <div style={{ position: 'absolute', left: '28%', top: '55%', zIndex: 2, textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0d1b8e', lineHeight: 1.2 }}>
              My child is safe;<br />
              <span style={{ fontSize: 12 }}>I thought same untill</span><br />
              <span style={{ fontSize: 12 }}>I discovered this</span>
            </div>
          </div>
          {/* Child silhouette placeholder */}
          <div style={{ width: 120, height: '100%', background: 'linear-gradient(to right, transparent, rgba(180,130,80,0.3))', position: 'absolute', left: 0, top: 0 }} />
          {/* Play button */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,95,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(59,95,255,0.25)', zIndex: 3 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', textTransform: 'uppercase', paddingBottom: 10 }}>
        SCROLL
      </div>
    </div>
  );
}

/** Campaign Landing — "Who are you?" persona selector */
function CampaignLandingLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#09090f', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', position: 'relative' }}>
      {/* Light rays background */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(59,95,255,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>SmartSapp · Campaign</div>
        <div style={{ fontSize: 44, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-2px', lineHeight: 1, marginBottom: 28, color: 'white' }}>Who are<br />you?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* School card */}
          <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>
            <div style={{ height: 90, background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', display: 'flex', alignItems: 'flex-end', padding: '10px 14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 7, fontWeight: 900, background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '3px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>For Institutions</div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 7px', marginBottom: 2, backdropFilter: 'blur(4px)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>School<br />Owner / Staff</div>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 9, fontWeight: 900, color: '#3B5FFF', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Select
              <div style={{ width: 22, height: 22, background: '#3B5FFF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>
          {/* Parent card */}
          <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ height: 90, background: 'linear-gradient(135deg, #ea580c 0%, #e11d48 100%)', display: 'flex', alignItems: 'flex-end', padding: '10px 14px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 7, fontWeight: 900, background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '3px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>For Families</div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 7px', marginBottom: 2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>A Parent</div>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 9, fontWeight: 900, color: '#3B5FFF', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Select
              <div style={{ width: 22, height: 22, background: '#3B5FFF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 8, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>© {new Date().getFullYear()} SmartSapp · Institutional Intelligence</div>
      </div>
    </div>
  );
}

/** Campaign Stats — analytics dashboard */
function CampaignStatsLayout() {
  const bars = [
    { label: 'Institutional', value: 62, color: '#3B5FFF' },
    { label: 'Families',      value: 31, color: '#f97316' },
    { label: 'Undecided',     value: 7,  color: '#64748b' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#09090f', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign Audit Hub</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: 2 }}>School Comparison Performance</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 100, padding: '4px 12px', fontSize: 8, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
          Live Monitoring
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '14px 18px 10px' }}>
        {[
          { label: 'Public Reach',  value: '1,284', color: '#3B5FFF', bg: 'rgba(59,95,255,0.12)' },
          { label: 'Persona Pull',  value: '73.2%', color: '#34d399', bg: 'rgba(16,185,129,0.10)' },
          { label: 'Engagement',    value: '44s',   color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
          { label: 'Total Intent',  value: '940',   color: '#fb923c', bg: 'rgba(251,146,60,0.10)' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '10px 10px' }}>
            <div style={{ width: 22, height: 22, borderRadius: 8, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: stat.color, opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'white', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ margin: '0 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Audience Distribution</div>
        {bars.map((bar, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{bar.label}</span>
              <span style={{ fontSize: 9, fontWeight: 900, color: bar.color }}>{bar.value}%</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ width: `${bar.value}%`, height: '100%', background: bar.color, borderRadius: 100 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Subscription Payment — pricing card */
function PaymentLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: 24, border: '1px solid #e2e8f0', padding: '28px 26px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.07)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>SmartSapp · Professional</div>
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>$49<span style={{ fontSize: 16, color: '#64748b', fontWeight: 500 }}>/mo</span></div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Everything your school needs</div>
        </div>
        {['Unlimited workspaces', 'White-label portal', 'Priority support', 'Advanced analytics'].map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#475569', marginBottom: 10 }}>
            <div style={{ width: 18, height: 18, background: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            {f}
          </div>
        ))}
        <div style={{ background: '#6366f1', borderRadius: 12, padding: '12px', color: 'white', fontSize: 12, fontWeight: 800, textAlign: 'center', marginTop: 16 }}>
          Start 14-Day Free Trial →
        </div>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#94a3b8', marginTop: 10 }}>No credit card required</div>
      </div>
    </div>
  );
}

/** New School Signup — registration form */
function SchoolSignupLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#09090f', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#09090f"><circle cx="12" cy="12" r="10"/></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800 }}>SmartSapp</span>
        <div style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, background: '#10b981', padding: '3px 10px', borderRadius: 100, color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New School</div>
      </div>
      <div style={{ padding: '24px 24px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Join the Network</div>
        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>Register Your<br />School</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 18 }}>Join 500+ schools building smarter parent relationships</div>
      </div>
      <div style={{ margin: '0 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' }}>
        {['School Name', 'Your Name', 'Email Address', 'Phone Number'].map((label, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ height: 28, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
          </div>
        ))}
        <div style={{ background: '#10b981', borderRadius: 10, padding: '11px', color: 'white', fontSize: 11, fontWeight: 800, textAlign: 'center', marginTop: 6 }}>
          Register My School →
        </div>
      </div>
    </div>
  );
}

/** Results Directory — list of form results */
function ResultsDirectoryLayout() {
  const entries = [
    { name: 'Sunrise Academy', score: '94%',  badge: 'Completed', color: '#10b981' },
    { name: 'Bright Futures',  score: '87%',  badge: 'Completed', color: '#10b981' },
    { name: 'Star Schools',    score: '72%',  badge: 'Pending',   color: '#f59e0b' },
    { name: 'Unity College',   score: '—',    badge: 'In Review', color: '#6366f1' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#09090f', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>SmartSapp</div>
        <div style={{ fontSize: 8, fontWeight: 700, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 100, padding: '3px 10px', color: '#a5b4fc' }}>RESULTS DIRECTORY</div>
      </div>
      <div style={{ padding: '18px 24px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Shared Results</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 14 }}>All Submissions</div>
        {/* Search bar mock */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', gap: 8, marginBottom: 14 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Search results...</div>
        </div>
        {/* Results list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>{entry.name}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Score: {entry.score}</div>
              </div>
              <div style={{ fontSize: 8, fontWeight: 800, background: `${entry.color}20`, border: `1px solid ${entry.color}40`, borderRadius: 100, padding: '3px 9px', color: entry.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {entry.badge}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page key → layout map ────────────────────────────────────────────────────

type LayoutComponent = React.ComponentType<PortalPreviewProps>;

const CUSTOM_PAGE_LAYOUTS: Record<string, LayoutComponent> = {
  '/':                                    HomepageLayout,
  '/campaign/school-comparison':          CampaignLandingLayout,
  '/campaign/school-comparison/statistics': CampaignStatsLayout,
  '/p/subscription-payment':              PaymentLayout,
  '/register-new-signup':                 SchoolSignupLayout,
  '/forms/results':                       ResultsDirectoryLayout,
};

// ─── Survey Layout ────────────────────────────────────────────────────────────

function SurveyLayout({ title, description, entityName, logoUrl, backgroundColor, questionCount = 5, themeColor = '#6366f1' }: PortalPreviewProps) {
  const bg = backgroundColor && backgroundColor !== '#ffffff' ? backgroundColor : '#f8fafc';
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: bg, minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 28, height: 28, borderRadius: 8, background: themeColor }} />}
          <span style={{ fontSize: 12, fontWeight: 700 }}>{entityName || 'SmartSapp'}</span>
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, background: `${themeColor}15`, color: themeColor, padding: '3px 10px', borderRadius: 100, border: `1px solid ${themeColor}30` }}>SURVEY</div>
      </div>
      <div style={{ padding: '28px 24px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{questionCount} Questions · ~3 min</div>
        <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, marginBottom: 8, color: '#0f172a' }}>{title}</div>
        {description && <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{description}</div>}
      </div>
      <div style={{ margin: '0 24px', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Question 1 of {questionCount}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>What best describes your experience?</div>
        {['Excellent', 'Good', 'Needs Improvement'].map((opt, i) => (
          <div key={i} style={{ padding: '8px 12px', borderRadius: 10, border: i === 0 ? `2px solid ${themeColor}` : '1.5px solid #e2e8f0', background: i === 0 ? `${themeColor}0d` : 'white', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: i === 0 ? `4px solid ${themeColor}` : '1.5px solid #cbd5e1', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: i === 0 ? themeColor : '#475569' }}>{opt}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 24px 18px' }}>
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 100, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${(1 / questionCount) * 100}%`, height: '100%', background: themeColor, borderRadius: 100 }} />
        </div>
        <div style={{ background: themeColor, borderRadius: 12, padding: '11px', color: 'white', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Begin Survey →</div>
      </div>
    </div>
  );
}

// ─── PDF Layout ───────────────────────────────────────────────────────────────

function PDFLayout({ title, entityName, logoUrl, fieldCount = 4, themeColor = '#f97316' }: PortalPreviewProps) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f1f5f9', minHeight: '100%', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f172a', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 26, height: 26, borderRadius: 6, background: themeColor }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{entityName || 'SmartSapp'}</span>
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8' }}>SECURE DOCUMENT</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 18px', gap: 10 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>{fieldCount} required fields</div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', flex: 1 }}>
          {[90, 75, 85].map((w, i) => <div key={i} style={{ height: 5, background: '#f1f5f9', borderRadius: 4, marginBottom: 7, width: `${w}%` }} />)}
          <div style={{ height: 1, background: '#e2e8f0', margin: '10px 0' }} />
          {['Full Legal Name', 'Date', 'Signature'].map((label, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
              <div style={{ height: i === 2 ? 30 : 22, border: i === 2 ? `2px dashed ${themeColor}` : '1px solid #e2e8f0', borderRadius: 7, background: i === 2 ? `${themeColor}08` : '#f8fafc', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                {i === 2 && <span style={{ fontSize: 8, color: themeColor, fontWeight: 700 }}>✎ Tap to sign</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: themeColor, borderRadius: 11, padding: '11px', color: 'white', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>Review & Sign Document →</div>
      </div>
    </div>
  );
}

// ─── Meeting Layout ───────────────────────────────────────────────────────────

function MeetingLayout({ title, description, entityName, logoUrl, meetingTime, themeColor = '#8b5cf6' }: PortalPreviewProps) {
  const dateLabel = meetingTime ? new Date(meetingTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Upcoming Event';
  const timeLabel = meetingTime ? new Date(meetingTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f0c29', minHeight: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 24px 16px', background: `linear-gradient(135deg, ${themeColor}25 0%, transparent 70%)`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.2)' }} /> : <div style={{ width: 28, height: 28, borderRadius: 8, background: themeColor, flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{entityName || 'SmartSapp'}</div>
            <div style={{ fontSize: 7, fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>LIVE EVENT</div>
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, marginBottom: 8 }}>{title}</div>
        {description && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{description}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <div style={{ fontSize: 8, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 10px' }}>📅 {dateLabel}</div>
          {timeLabel && <div style={{ fontSize: 8, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 10px' }}>🕐 {timeLabel}</div>}
        </div>
      </div>
      <div style={{ padding: '14px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Register to Join</div>
        {['Full Name', 'Email Address'].map((label, i) => (
          <div key={i}>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
            <div style={{ height: 28, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
          </div>
        ))}
        <div style={{ background: themeColor, borderRadius: 10, padding: '10px', color: 'white', fontSize: 10, fontWeight: 700, textAlign: 'center', marginTop: 4 }}>Reserve My Spot →</div>
        <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>Free · 47 already registered</div>
      </div>
    </div>
  );
}

// ─── Layout routing ───────────────────────────────────────────────────────────

const KIND_LAYOUT_MAP: Record<PortalPreviewProps['kind'], LayoutComponent> = {
  survey:  SurveyLayout,
  pdf:     PDFLayout,
  meeting: MeetingLayout,
  custom:  HomepageLayout, // default for custom; overridden by pageKey
};

// ─── PortalPreview ────────────────────────────────────────────────────────────

export const PortalPreview = React.memo(function PortalPreview(props: PortalPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const innerRef     = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    const inner     = innerRef.current;
    if (!container || !inner) return;
    if (typeof ResizeObserver === 'undefined') return;

    const applyScale = (w: number, h: number) => {
      const scale = w / 900;
      inner.style.transform       = `scale(${scale})`;
      inner.style.transformOrigin = 'top left';
      inner.style.width           = '900px';
      inner.style.height          = `${h / scale}px`;
    };

    applyScale(container.offsetWidth, container.offsetHeight);

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      requestAnimationFrame(() => applyScale(width, height));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Route to the correct layout:
  // 1. Custom pages with a known pageKey get their specific faithful recreation
  // 2. All other kinds use their own layout
  let Layout: LayoutComponent;
  if (props.kind === 'custom' && props.pageKey && CUSTOM_PAGE_LAYOUTS[props.pageKey]) {
    Layout = CUSTOM_PAGE_LAYOUTS[props.pageKey];
  } else {
    Layout = KIND_LAYOUT_MAP[props.kind] ?? HomepageLayout;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ '--accent': props.themeColor ?? '#6366f1' } as React.CSSProperties}
    >
      <div ref={innerRef} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Layout {...props} />
      </div>
    </div>
  );
});

PortalPreview.displayName = 'PortalPreview';
