import { useState } from 'react'

function Step({ num, title, children, delay }) {
  return (
    <div style={s.step} className="fade-up" style={{ animationDelay: delay }}>
      <div style={s.stepNum}>{num}</div>
      <div style={s.stepBody}>
        <h3 style={s.stepTitle}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Code({ children, onCopy }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={s.codeWrap}>
      <pre style={s.code}>{children}</pre>
      <button style={s.copyBtn} onClick={copy}>{copied ? '✓' : 'Copy'}</button>
    </div>
  )
}

function PlatformTab({ tabs, children }) {
  const [active, setActive] = useState(0)
  return (
    <div style={s.platformBlock}>
      <div style={s.platformTabs}>
        {tabs.map((t, i) => (
          <button key={t} style={{ ...s.platformTab, ...(active === i ? s.platformTabActive : {}) }}
            onClick={() => setActive(i)}>{t}</button>
        ))}
      </div>
      <div style={s.platformContent}>{children[active]}</div>
    </div>
  )
}

export default function SetupTab() {
  const host = window.location.hostname === 'localhost' ? 'your-server-ip' : window.location.hostname

  return (
    <div>
      <div style={s.header} className="fade-up">
        <h2 style={s.title}>Setup Guide</h2>
        <p style={s.sub}>Get connected in under 2 minutes.</p>
      </div>

      <div style={s.steps}>
        <Step num="1" title="Create an API key" delay="0.05s">
          <p style={s.text}>Go to the <strong>API Keys</strong> tab and click <em>+ New Key</em>. Give it a label like "laptop" or "server". Copy the key immediately — it's only shown once.</p>
          <div style={s.notice}>
            Your API key acts as both the username and password for proxy authentication.
          </div>
        </Step>

        <Step num="2" title="Configure your client" delay="0.10s">
          <PlatformTab tabs={['curl', 'Python', 'Node.js', 'Browser', 'System']}>
            {/* curl */}
            <div>
              <p style={s.text}>Pass the proxy with <code style={s.inlineCode}>-x</code> and credentials with <code style={s.inlineCode}>-U</code>:</p>
              <Code>{`curl -x http://${host}:3128 \\
  -U "pak_YOUR_KEY:pak_YOUR_KEY" \\
  https://api.ipify.org`}</Code>
            </div>

            {/* Python */}
            <div>
              <Code>{`import requests

proxies = {
    "http":  "http://pak_YOUR_KEY:pak_YOUR_KEY@${host}:3128",
    "https": "http://pak_YOUR_KEY:pak_YOUR_KEY@${host}:3128",
}

r = requests.get("https://api.ipify.org", proxies=proxies)
print(r.text)  # your proxy's IP`}</Code>
            </div>

            {/* Node.js */}
            <div>
              <Code>{`import { HttpsProxyAgent } from 'https-proxy-agent'

const agent = new HttpsProxyAgent(
  'http://pak_YOUR_KEY:pak_YOUR_KEY@${host}:3128'
)

const res = await fetch('https://api.ipify.org', { agent })
console.log(await res.text())`}</Code>
              <p style={{ ...s.text, marginTop: 10 }}>Install: <code style={s.inlineCode}>npm install https-proxy-agent</code></p>
            </div>

            {/* Browser */}
            <div>
              <p style={s.text}>In your browser's proxy settings (or a proxy extension like Proxy SwitchyOmega):</p>
              <div style={s.table}>
                {[
                  ['Type', 'HTTP'],
                  ['Host', host],
                  ['Port', '3128'],
                  ['Username', 'pak_YOUR_KEY'],
                  ['Password', 'pak_YOUR_KEY'],
                ].map(([k, v]) => (
                  <div key={k} style={s.tableRow}>
                    <span style={s.tableKey}>{k}</span>
                    <code style={s.tableVal}>{v}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* System */}
            <div>
              <p style={s.text}>Set environment variables (Linux/macOS):</p>
              <Code>{`export http_proxy="http://pak_YOUR_KEY:pak_YOUR_KEY@${host}:3128"
export https_proxy="http://pak_YOUR_KEY:pak_YOUR_KEY@${host}:3128"
export no_proxy="localhost,127.0.0.1"`}</Code>
              <p style={{ ...s.text, marginTop: 12 }}>Add to <code style={s.inlineCode}>~/.bashrc</code> or <code style={s.inlineCode}>~/.zshrc</code> to make it permanent.</p>
            </div>
          </PlatformTab>
        </Step>

        <Step num="3" title="Verify it's working" delay="0.15s">
          <p style={s.text}>Your request's IP should match the proxy server, not your real IP:</p>
          <Code>{`# Should return your proxy server's IP, not yours
curl -x http://${host}:3128 \\
  -U "pak_YOUR_KEY:pak_YOUR_KEY" \\
  https://api.ipify.org`}</Code>
        </Step>

        <Step num="4" title="Monitor usage" delay="0.20s">
          <p style={s.text}>Check the <strong>Usage</strong> tab to see bandwidth consumed, request counts, and daily breakdowns. Limits reset on the 1st of each month.</p>
          
        </Step>
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: 32 },
  title: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 },
  sub: { color: 'var(--muted)', fontSize: 14 },
  steps: { display: 'flex', flexDirection: 'column', gap: 0 },
  step: { display: 'flex', gap: 24, paddingBottom: 36, position: 'relative' },
  stepNum: {
    width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)',
    border: '1px solid var(--border2)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontFamily: 'var(--font-head)', fontWeight: 700,
    fontSize: 14, color: 'var(--accent2)', flexShrink: 0, marginTop: 2,
  },
  stepBody: { flex: 1, paddingTop: 4 },
  stepTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 17, marginBottom: 14, letterSpacing: '-0.01em' },
  text: { color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 },
  notice: {
    background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.2)',
    borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--accent2)',
  },
  codeWrap: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '14px 16px', position: 'relative', marginBottom: 8,
  },
  code: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: 52 },
  copyBtn: {
    position: 'absolute', top: 10, right: 10, background: 'var(--bg2)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
    padding: '3px 10px', cursor: 'pointer',
  },
  inlineCode: { fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, color: 'var(--accent2)' },
  platformBlock: { border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  platformTabs: { display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' },
  platformTab: {
    background: 'none', border: 'none', color: 'var(--muted)',
    fontFamily: 'var(--font-mono)', fontSize: 12, padding: '10px 18px',
    cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -1, transition: 'all 0.15s',
  },
  platformTabActive: { color: 'var(--text)', borderBottomColor: 'var(--accent)' },
  platformContent: { padding: '20px' },
  table: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  tableRow: { display: 'flex', gap: 16, alignItems: 'center' },
  tableKey: { width: 90, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tableVal: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent2)', background: 'var(--bg3)', padding: '3px 10px', borderRadius: 4 },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 },
  planCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' },
  planHighlight: { border: '1px solid var(--accent)', background: 'rgba(124,109,250,0.05)' },
  planHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  planName: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14 },
  planPrice: { fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--accent2)', fontWeight: 500 },
  planPer: { fontSize: 11, color: 'var(--muted)' },
  planRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--border)' },
  planKey: { fontSize: 11, color: 'var(--muted)' },
  planVal: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' },
}
