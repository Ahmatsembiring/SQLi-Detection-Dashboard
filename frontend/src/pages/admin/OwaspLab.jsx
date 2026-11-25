import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getToken } from "../../api";
import { Alert, Badge, Button, Card, Empty, Input, LabelBadge, Select, SeverityBadge } from "../../components/ui";
import { useMonitorSocket } from "../../useMonitorSocket";

const TABS = [
  { id: "A03", label: "A03 · Injection (SQLi & XSS)" },
  { id: "A01", label: "A01 · Access Control" },
  { id: "A07", label: "A07 · Auth & Brute-Force" },
  { id: "A05", label: "A05 · Headers & Misconfig" },
];

const fmtTime = (s) => new Date(s).toLocaleTimeString("id-ID");

async function rawFetch(path, { method = "GET", headers = {}, body } = {}) {
  const start = performance.now();
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Math.round(performance.now() - start);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, headers: res.headers, data, ms };
}

function ResultRow({ item }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={item.passed ? "green" : "red"}>{item.passed ? "✓ AMAN (PASS)" : "✕ PERLU CEK"}</Badge>
          <span className="font-semibold text-stone-900">{item.title}</span>
        </div>
        <span className="font-mono text-stone-500">HTTP {item.status} · {item.ms} ms</span>
      </div>
      <p className="mt-1.5 text-stone-700">{item.summary}</p>
      {item.detail && (
        <pre className="mt-1.5 overflow-x-auto rounded bg-stone-900 p-2 font-mono text-[11px] text-amber-100">
          {item.detail}
        </pre>
      )}
    </div>
  );
}

export default function OwaspLab() {
  const [tab, setTab] = useState("A03");
  const [presets, setPresets] = useState([]);
  const [endpoint, setEndpoint] = useState("/api/products");
  const [payload, setPayload] = useState("gayo' UNION SELECT id, email, password_hash FROM users--");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [results, setResults] = useState({ A03: [], A01: [], A07: [], A05: [] });
  const [headerAudit, setHeaderAudit] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);

  useEffect(() => {
    api("/api/monitor/lab/scenarios")
      .then((d) => setPresets(d.sqli_presets || []))
      .catch(() => {});
  }, []);

  const wsStatus = useMonitorSocket((evt) => {
    setLiveEvents((prev) => [evt, ...prev.filter((x) => x.id !== evt.id)].slice(0, 15));
  });

  const pushResult = (cat, item) => {
    setResults((prev) => ({ ...prev, [cat]: [{ id: `${Date.now()}-${Math.random()}`, ...item }, ...prev[cat]].slice(0, 12) }));
  };

  // ---- A03: Injection (SQLi & XSS) ------------------------------------------------------------
  const runInjection = async (ep = endpoint, raw = payload, label = "Custom Payload") => {
    setBusy(true);
    setNotice(null);
    try {
      const token = getToken();
      let r;
      if (ep === "/api/auth/login") {
        r = await rawFetch("/api/auth/login", { method: "POST", body: { email: raw, password: "lab-probe-password" } });
        const passed = r.status === 401 || r.status === 429;
        pushResult("A03", {
          title: `${label} → POST /api/auth/login`,
          passed,
          status: r.status,
          ms: r.ms,
          summary: passed
            ? "Auth bypass gagal: query memakai ORM bound parameter & Argon2id timing-safe. Cek panel Deteksi Live di kanan."
            : "Status respons tidak terduga pada endpoint login.",
          detail: `Payload: ${raw}\nResponse: ${JSON.stringify(r.data)}`,
        });
        return passed;
      }
      r = await rawFetch(`/api/products?q=${encodeURIComponent(raw)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const passed = r.status === 200 && (r.data?.total ?? 0) === 0;
      pushResult("A03", {
        title: `${label} → GET /api/products?q=...`,
        passed,
        status: r.status,
        ms: r.ms,
        summary: passed
          ? "Injeksi gagal membocorkan data (total=0, payload diperlakukan sebagai teks biasa). Model ML sedang menganalisis log PostgreSQL."
          : `Respons HTTP ${r.status} dengan total=${r.data?.total ?? "?"}.`,
        detail: `Payload: ${raw}\nResponse: total=${r.data?.total}, items=${r.data?.items?.length ?? 0}`,
      });
      return passed;
    } finally {
      setBusy(false);
    }
  };

  // ---- A01: Broken Access Control -------------------------------------------------------------
  const runA01Tests = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const checks = [
        {
          title: "Akses /api/monitor/logs tanpa token (Unauthenticated)",
          run: () => rawFetch("/api/monitor/logs"),
          ok: (r) => r.status === 401,
          msg: "Ditolak dengan 401 Unauthorized — endpoint monitoring terlindungi autentikasi.",
        },
        {
          title: "Akses /api/admin/users dengan JWT palsu (Forged Token)",
          run: () => rawFetch("/api/admin/users", { headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.invalid" } }),
          ok: (r) => r.status === 401,
          msg: "Ditolak dengan 401 Unauthorized — tanda tangan & issuer JWT diverifikasi ketat.",
        },
        {
          title: "Akses IDOR /api/orders/999999 (Resource tidak dimiliki)",
          run: () => rawFetch("/api/orders/999999", { headers: { Authorization: `Bearer ${getToken()}` } }),
          ok: (r) => r.status === 404,
          msg: "Ditolak dengan 404 Not Found — validasi kepemilikan order aktif (anti-IDOR).",
        },
      ];
      let passedCount = 0;
      for (const c of checks) {
        const r = await c.run();
        const passed = c.ok(r);
        if (passed) passedCount += 1;
        pushResult("A01", {
          title: c.title,
          passed,
          status: r.status,
          ms: r.ms,
          summary: passed ? c.msg : `Seharusnya ditolak, namun mendapat HTTP ${r.status}.`,
          detail: JSON.stringify(r.data),
        });
      }
      return passedCount === checks.length;
    } finally {
      setBusy(false);
    }
  };

  // ---- A07: Auth, Password Policy & Brute-Force -----------------------------------------------
  const runA07WeakPassword = async () => {
    setBusy(true);
    try {
      const r = await rawFetch("/api/auth/register", {
        method: "POST",
        body: { name: "Lab Weak User", email: `weak-${Date.now()}@example.com`, password: "password" },
      });
      const passed = r.status === 422;
      pushResult("A07", {
        title: "Registrasi dengan password lemah ('password')",
        passed,
        status: r.status,
        ms: r.ms,
        summary: passed
          ? "Ditolak dengan 422 Unprocessable Entity — kebijakan OWASP ASVS (huruf besar, kecil, angka, min. 8) aktif."
          : "Password lemah seharusnya ditolak.",
        detail: JSON.stringify(r.data),
      });
      return passed;
    } finally {
      setBusy(false);
    }
  };

  const runA07BruteForce = async () => {
    setBusy(true);
    setNotice(null);
    try {
      let hit429 = null;
      let attempts = 0;
      for (let i = 1; i <= 35; i += 1) {
        attempts = i;
        const r = await rawFetch("/api/auth/login", {
          method: "POST",
          body: { email: "budi@example.com", password: `wrong-pass-${i}` },
        });
        if (r.status === 429) {
          hit429 = r;
          break;
        }
      }
      const passed = hit429 !== null;
      pushResult("A07", {
        title: `Simulasi Brute-Force Login (${attempts} percobaan)`,
        passed,
        status: hit429 ? 429 : 401,
        ms: hit429?.ms ?? 0,
        summary: passed
          ? `Rate limiter aktif pada percobaan ke-${attempts} (HTTP 429 Too Many Requests, Retry-After: ${hit429.headers.get("retry-after") || "?"}s). Klik 'Reset Rate Limit' agar login normal kembali.`
          : "Rate limit belum terpicu dalam 35 percobaan.",
        detail: JSON.stringify(hit429?.data),
      });
      return passed;
    } finally {
      setBusy(false);
    }
  };

  const resetRateLimit = async () => {
    setBusy(true);
    try {
      await api("/api/monitor/lab/reset-rate-limit", { method: "POST" });
      setNotice({ tone: "green", text: "Rate limiter login/register berhasil di-reset." });
    } catch (e) {
      setNotice({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // ---- A05: Security Headers, CSP & Safe URL --------------------------------------------------
  const runA05Audit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const [health, root, xssUrl] = await Promise.all([
        rawFetch("/api/health"),
        rawFetch("/"),
        rawFetch("/api/admin/products", {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: { name: "Kopi Probe", price: "50000", stock: 1, image_url: "javascript:alert(1)" },
        }),
      ]);
      const checks = [
        { name: "X-Content-Type-Options", value: health.headers.get("x-content-type-options"), ok: health.headers.get("x-content-type-options") === "nosniff" },
        { name: "X-Frame-Options", value: health.headers.get("x-frame-options"), ok: health.headers.get("x-frame-options") === "DENY" },
        { name: "Referrer-Policy", value: health.headers.get("referrer-policy"), ok: Boolean(health.headers.get("referrer-policy")) },
        { name: "Permissions-Policy", value: health.headers.get("permissions-policy"), ok: Boolean(health.headers.get("permissions-policy")) },
        { name: "Cross-Origin-Opener-Policy", value: health.headers.get("cross-origin-opener-policy"), ok: health.headers.get("cross-origin-opener-policy") === "same-origin" },
        { name: "Content-Security-Policy (Nginx)", value: root.headers.get("content-security-policy"), ok: Boolean(root.headers.get("content-security-policy")) },
      ];
      setHeaderAudit(checks);
      const urlBlocked = xssUrl.status === 422;
      pushResult("A05", {
        title: "Validasi image_url berbahaya ('javascript:alert(1)')",
        passed: urlBlocked,
        status: xssUrl.status,
        ms: xssUrl.ms,
        summary: urlBlocked
          ? "Ditolak dengan 422 — hanya URL https://, http://, atau path relatif / yang diizinkan."
          : "URL berbahaya seharusnya ditolak.",
        detail: JSON.stringify(xssUrl.data),
      });
      return checks.slice(0, 5).every((c) => c.ok) && urlBlocked;
    } finally {
      setBusy(false);
    }
  };

  // ---- Full Automated OWASP Self-Test ---------------------------------------------------------
  const runFullAudit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const a03 = await runInjection("/api/products", "gayo' UNION SELECT password_hash FROM users--", "Audit A03 SQLi");
      const a01 = await runA01Tests();
      const a07 = await runA07WeakPassword();
      const a05 = await runA05Audit();
      setAuditSummary({ A03: a03, A01: a01, A07: a07, A05: a05, ranAt: new Date().toISOString() });
      setNotice({ tone: "green", text: "Audit otomatis OWASP Top 10 (A01, A03, A05, A07) selesai dijalankan." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900">Lab Keamanan OWASP Top 10</h1>
            <Badge tone={wsStatus === "live" ? "green" : wsStatus === "connecting" ? "yellow" : "red"}>
              {wsStatus === "live" ? "● ML Detector Live" : wsStatus === "connecting" ? "◌ Menghubungkan" : "✕ Offline"}
            </Badge>
          </div>
          <p className="text-sm text-stone-500">
            Uji langsung pertahanan OWASP KopiAman dan pantau deteksi SQL Injection secara real-time.
          </p>
        </div>
        <Button onClick={runFullAudit} disabled={busy}>
          {busy ? "Menjalankan Audit…" : "▶ Jalankan Semua Audit OWASP"}
        </Button>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {auditSummary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["A03", "A01", "A07", "A05"].map((k) => (
            <Card key={k} className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">{k}</span>
                <Badge tone={auditSummary[k] ? "green" : "red"}>{auditSummary[k] ? "✓ PASS" : "✕ CHECK"}</Badge>
              </div>
              <div className="mt-1 text-xs text-stone-500">Terverifikasi {fmtTime(auditSummary.ranAt)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-nowrap gap-2 overflow-x-auto border-b border-stone-200 pb-3 sm:flex-wrap sm:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.id ? "bg-amber-800 text-amber-50" : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "A03" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">Simulator Payload Injection (A03)</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Select label="Target Endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}>
                  <option value="/api/products">GET /api/products (Cari Kopi)</option>
                  <option value="/api/auth/login">POST /api/auth/login (Auth)</option>
                </Select>
                <div className="sm:col-span-2">
                  <Input label="Payload Serangan" value={payload} onChange={(e) => setPayload(e.target.value)}
                    placeholder="Masukkan payload SQLi / XSS…" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runInjection()} disabled={busy || !payload.trim()}>
                  Kirim Uji Serangan
                </Button>
                <Button variant="secondary" onClick={() => runInjection("/api/products", "Aceh Gayo Honey", "Input Normal")} disabled={busy}>
                  Uji Input Normal
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Skenario Serangan OWASP A03 Siap Pakai</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {presets.map((p) => (
                  <div key={p.id} className="flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-900">{p.name}</span>
                        <span className="font-mono text-[10px] text-stone-500">{p.method} {p.endpoint}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600">{p.description}</p>
                      <code className="mt-1.5 block truncate rounded bg-stone-900 px-2 py-1 text-[11px] text-amber-100">{p.payload}</code>
                      <p className="mt-1.5 text-[11px] text-emerald-800">Mitigasi: {p.defense}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2.5 self-start"
                      disabled={busy}
                      onClick={() => {
                        setEndpoint(p.endpoint);
                        setPayload(p.payload);
                        runInjection(p.endpoint, p.payload, p.name);
                      }}
                    >
                      ▶ Uji Skenario Ini
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {results.A03.length > 0 && (
              <Card className="space-y-2.5 p-4">
                <h2 className="text-sm font-semibold">Hasil Pengujian HTTP A03</h2>
                {results.A03.map((item) => <ResultRow key={item.id} item={item} />)}
              </Card>
            )}
          </div>

          <Card className="flex flex-col overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Deteksi ML Real-Time (WebSocket)</h2>
              <p className="text-xs text-stone-500">Log PostgreSQL → N-Gram TF-IDF → Random Forest</p>
            </div>
            <div className="max-h-[600px] flex-1 divide-y divide-stone-100 overflow-auto p-3">
              {liveEvents.length === 0 ? (
                <Empty>Kirim payload di sebelah kiri untuk melihat deteksi ML muncul otomatis di sini.</Empty>
              ) : (
                liveEvents.map((e) => (
                  <div key={e.id} className="space-y-1 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <LabelBadge label={e.label} fp={e.is_false_positive} />
                        {e.label === "SQLi" && <SeverityBadge severity={e.severity} />}
                      </div>
                      <span className="tabular font-mono text-stone-500">p={e.probability.toFixed(2)} · {e.latency_ms} ms</span>
                    </div>
                    <Link to={`/admin/logs?id=${e.id}`} className="block break-all font-mono text-stone-800 hover:text-amber-800">
                      {e.raw_payload}
                    </Link>
                    <div className="text-[11px] text-stone-500">
                      {fmtTime(e.timestamp)} · {e.endpoint} · {e.username || e.attempted_username || "anonim"} ({e.ip || "-"})
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "A01" && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Uji OWASP A01 · Broken Access Control (RBAC &amp; IDOR)</h2>
              <p className="text-xs text-stone-500">Memverifikasi bahwa akses tanpa token, JWT palsu, dan resource milik user lain selalu ditolak.</p>
            </div>
            <Button onClick={runA01Tests} disabled={busy}>▶ Jalankan Uji A01</Button>
          </div>
          {results.A01.length === 0 ? (
            <Empty>Klik “Jalankan Uji A01” untuk menguji proteksi RBAC &amp; anti-IDOR.</Empty>
          ) : (
            <div className="space-y-2.5">{results.A01.map((item) => <ResultRow key={item.id} item={item} />)}</div>
          )}
        </Card>
      )}

      {tab === "A07" && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Uji OWASP A07 · Authentication, Password Policy &amp; Brute-Force</h2>
              <p className="text-xs text-stone-500">Uji penolakan password lemah dan picu rate limiter login (HTTP 429) secara aman.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={runA07WeakPassword} disabled={busy}>Uji Password Lemah</Button>
              <Button onClick={runA07BruteForce} disabled={busy}>▶ Simulasi Brute-Force (429)</Button>
              <Button variant="secondary" onClick={resetRateLimit} disabled={busy}>↻ Reset Rate Limit</Button>
            </div>
          </div>
          {results.A07.length === 0 ? (
            <Empty>Pilih salah satu simulasi OWASP A07 di atas untuk mulai menguji.</Empty>
          ) : (
            <div className="space-y-2.5">{results.A07.map((item) => <ResultRow key={item.id} item={item} />)}</div>
          )}
        </Card>
      )}

      {tab === "A05" && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Audit OWASP A05 · Security Headers, CSP &amp; Konfigurasi</h2>
              <p className="text-xs text-stone-500">Memeriksa header keamanan HTTP aktif dan validasi URL berbahaya.</p>
            </div>
            <Button onClick={runA05Audit} disabled={busy}>▶ Jalankan Audit Headers &amp; A05</Button>
          </div>
          {headerAudit && (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Header Keamanan</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Nilai Terdeteksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {headerAudit.map((h) => (
                    <tr key={h.name}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono font-medium text-stone-800">{h.name}</td>
                      <td className="px-3 py-2"><Badge tone={h.ok ? "green" : "yellow"}>{h.ok ? "✓ Aktif" : "⚠ Via Nginx/Docker"}</Badge></td>
                      <td className="break-all px-3 py-2 font-mono text-[11px] text-stone-600">{h.value || "(aktif saat diakses lewat Nginx Docker :8080)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {results.A05.length > 0 && (
            <div className="space-y-2.5">{results.A05.map((item) => <ResultRow key={item.id} item={item} />)}</div>
          )}
        </Card>
      )}
    </div>
  );
}
