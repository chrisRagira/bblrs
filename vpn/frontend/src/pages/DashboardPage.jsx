import { useState } from 'react'
import { clearToken, getUser } from '../lib/api.js'
import OverviewTab from '../components/OverviewTab.jsx'
import KeysTab from '../components/KeysTab.jsx'
import SetupTab from '../components/SetupTab.jsx'
import UsageTab from '../components/UsageTab.jsx'
import PricingPage from '../components/PricingPage.jsx'
import AdminPage from '../components/AdminPage.jsx'

export default function DashboardPage({ onLogout }) {
  const [tab, setTab] = useState('overview')
  const user = getUser()
  const isAdmin = user?.is_admin === true

  function logout() {
    clearToken()
    onLogout()
  }

  const NAV = [
    { id: 'overview', label: 'Overview',    icon: '▦' },
    { id: 'keys',     label: 'API Keys',    icon: '⬡' },
    { id: 'usage',    label: 'Usage',       icon: '↗' },
    { id: 'pricing',  label: 'Pricing',     icon: '◈' },
    { id: 'setup',    label: 'Setup Guide', icon: '⊙' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: '⚙', danger: true }] : []),
  ]

  const TABS = {
    overview: OverviewTab,
    keys:     KeysTab,
    usage:    UsageTab,
    pricing:  PricingPage,
    setup:    SetupTab,
    admin:    AdminPage,
  }
  const ActiveTab = TABS[tab] ?? OverviewTab

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoMark}>P</span>
          <span style={s.logoText}>ProxyAaS</span>
        </div>

        <nav style={s.nav}>
          {NAV.map(n => (
            <button key={n.id}
              style={{
                ...s.navItem,
                ...(tab === n.id ? s.navActive : {}),
                ...(n.danger ? s.navDanger : {}),
              }}
              onClick={() => setTab(n.id)}>
              <span style={s.navIcon}>{n.icon}</span>
              {n.label}
              {tab === n.id && <span style={n.danger ? s.navDotDanger : s.navDot} />}
            </button>
          ))}
        </nav>

        {/* Current plan pill */}
        <div style={s.planPill}>
          <span style={s.planLabel}>Current plan</span>
          <span style={s.planValue}>{user?.plan ?? 'free'}</span>
          {user?.plan === 'free' && (
            <button style={s.upgradeBtn} onClick={() => setTab('pricing')}>Upgrade ↑</button>
          )}
        </div>

        <div style={s.sidebarFooter}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
            <div style={s.userMeta}>
              <span style={s.userEmail}>{user?.email ?? 'user'}</span>
              <span style={s.userPlan}>{user?.plan ?? 'free'} plan</span>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={logout} title="Sign out">↩</button>
        </div>
      </aside>

      <main style={s.main}>
        <div style={s.content} key={tab} className="fade-up">
          <ActiveTab onSelectPlan={plan => setTab('pricing')} />
        </div>
      </main>
    </div>
  )
}

const s = {
  root: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar: {
    width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'sticky',
    top: 0, height: '100vh', flexShrink: 0,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 20px 24px', borderBottom: '1px solid var(--border)',
  },
  logoMark: {
    width: 30, height: 30, background: 'var(--accent)', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 16, color: '#fff', flexShrink: 0,
  },
  logoText: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' },
  nav: { flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: 'none', border: 'none', color: 'var(--muted)',
    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 400,
    padding: '9px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
    textAlign: 'left', transition: 'all 0.15s', position: 'relative',
  },
  navActive: { background: 'rgba(124,109,250,0.12)', color: 'var(--text)', fontWeight: 500 },
  navDanger: { color: 'rgba(248,113,113,0.7)' },
  navIcon: { fontSize: 14, width: 18, textAlign: 'center', opacity: 0.8 },
  navDot: { position: 'absolute', right: 10, width: 5, height: 5, background: 'var(--accent)', borderRadius: '50%' },
  navDotDanger: { position: 'absolute', right: 10, width: 5, height: 5, background: 'var(--danger)', borderRadius: '50%' },
  planPill: {
    margin: '0 10px 16px', background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '10px 12px', display: 'flex',
    flexDirection: 'column', gap: 4,
  },
  planLabel: { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  planValue: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, textTransform: 'capitalize' },
  upgradeBtn: {
    background: 'rgba(124,109,250,0.15)', border: '1px solid rgba(124,109,250,0.3)',
    color: 'var(--accent2)', borderRadius: 'var(--radius)', padding: '4px 10px',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
    alignSelf: 'flex-start', transition: 'all 0.15s',
  },
  sidebarFooter: {
    padding: '16px 12px', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  userInfo: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: {
    width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)',
    border: '1px solid var(--border2)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, color: 'var(--accent2)',
  },
  userMeta: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  userEmail: { fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userPlan: { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  logoutBtn: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
    borderRadius: 'var(--radius)', width: 30, height: 30, cursor: 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s',
  },
  main: { flex: 1, overflowY: 'auto' },
  content: { padding: '40px 48px', maxWidth: 960 },
}