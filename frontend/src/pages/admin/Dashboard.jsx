import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api";
import { Badge, Card, Empty, LabelBadge, Select, SeverityBadge } from "../../components/ui";
import { useMonitorSocket } from "../../useMonitorSocket";

const FEED_SIZE = 50;
const fmtTime = (s) => new Date(s).toLocaleTimeString("id-ID");
const fmtNum = (n) => (n ?? 0).toLocaleString("id-ID");
const fmtMs = (n) => (n == null ? "–" : `${n.toFixed(1)} ms`);

function Kpi({ label, value, sub }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

function ChartTooltip({ active, payload, label, formatLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-slate-500">{formatLabel ? formatLabel(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-slate-800">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** A single ratio against the whole -> a meter, not a two-slice pie. */
function RatioMeter({ normal, sqli }) {
  const total = normal + sqli;
  const pct = total ? (sqli / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold">{pct.toFixed(1)}%</span>
        <span className="text-xs text-slate-500">input terklasifikasi SQLi</span>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[color:var(--grid)]" role="meter"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct.toFixed(1)} aria-label="Porsi SQLi">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--critical)" }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-slate-500">⚠ SQLi</dt><dd className="font-semibold tabular">{fmtNum(sqli)}</dd></div>
        <div><dt className="text-slate-500">● Normal</dt><dd className="font-semibold tabular">{fmtNum(normal)}</dd></div>
      </dl>
    </div>
  );
}

function actor(e) {
  if (e.username) return { name: e.username, sub: e.ip };
  if (e.attempted_username) return { name: `anonim (“${e.attempted_username.slice(0, 24)}”)`, sub: e.ip };
  return { name: "anonim", sub: e.ip };
}

export default function Dashboard() {
  const [hours, setHours] = useState(24);
  const [stats, setStats] = useState(null);
  const [posture, setPosture] = useState(null);
  const [feed, setFeed] = useState([]);
  const [onlySqli, setOnlySqli] = useState(true);
  const [flash, setFlash] = useState(new Set());
  const refreshTimer = useRef(null);

  const loadStats = useCallback(() => api("/api/monitor/stats", { params: { hours } }).then(setStats).catch(() => {}), [hours]);

  useEffect(() => {
    api("/api/monitor/security-posture").then(setPosture).catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [loadStats]);

  useEffect(() => {
    api("/api/monitor/logs", { params: { size: FEED_SIZE, label: onlySqli ? "SQLi" : undefined } })
      .then((r) => setFeed(r.items.map((x) => ({ ...x, username: x.username }))))
      .catch(() => {});
  }, [onlySqli]);

  const status = useMonitorSocket((d) => {
    if (onlySqli && d.label !== "SQLi") return;
    setFeed((f) => [d, ...f.filter((x) => x.id !== d.id)].slice(0, FEED_SIZE));
    if (d.label === "SQLi") {
      setFlash((s) => new Set(s).add(d.id));
      setTimeout(() => setFlash((s) => { const n = new Set(s); n.delete(d.id); return n; }), 4000);
    }
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(loadStats, 1500); // debounce chart refresh during bursts
  });

  const bucketFmt = (t) =>
    stats?.bucket_seconds >= 86400
      ? new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
      : new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const offenders = (stats?.top_offenders || []).map((o) => ({
    ...o,
    who: o.user_id ? o.name : `anonim · ${o.ip || "?"}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Monitoring SQL Injection</h1>
          <p className="text-sm text-slate-500">Log query PostgreSQL → n-gram TF-IDF → Random Forest, real-time.</p>
        </div>
        <div className="flex items-end gap-3">
          <Badge tone={status === "live" ? "green" : status === "connecting" ? "yellow" : "red"}>
            {status === "live" ? "● Live" : status === "connecting" ? "◌ Menghubungkan" : "✕ Offline"}
          </Badge>
          <div className="w-40">
            <Select label="Rentang waktu" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              <option value={1}>1 jam terakhir</option>
              <option value={24}>24 jam terakhir</option>
              <option value={168}>7 hari terakhir</option>
              <option value={720}>30 hari terakhir</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Input dianalisis" value={fmtNum(stats?.total)} />
        <Kpi label="SQLi terdeteksi" value={fmtNum(stats?.ratio.SQLi)} sub="tidak termasuk false positive" />
        <Kpi label="Pelaku teratas" value={fmtNum(offenders.length)} sub="aktor unik (maks. 10)" />
        <Kpi label="Latensi model" value={fmtMs(stats?.latency_ms.mean)} sub={`p95 ${fmtMs(stats?.latency_ms.p95)}`} />
        <Kpi label="Delay log → deteksi" value={fmtMs(stats?.pipeline_delay_ms.mean)} sub={`p95 ${fmtMs(stats?.pipeline_delay_ms.p95)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Percobaan SQLi per waktu</h2>
          <div className="mt-2 h-56">
            {stats && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={bucketFmt} tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    stroke="var(--axis)" minTickGap={32} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} stroke="var(--axis)" />
                  <Tooltip content={<ChartTooltip formatLabel={(t) => new Date(t).toLocaleString("id-ID")} />}
                    cursor={{ stroke: "var(--axis)" }} />
                  <Area type="monotone" dataKey="SQLi" name="SQLi" stroke="var(--critical)" strokeWidth={2}
                    fill="var(--critical)" fillOpacity={0.12} activeDot={{ r: 4 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Rasio Normal vs SQLi</h2>
          {stats && <RatioMeter normal={stats.ratio.Normal} sqli={stats.ratio.SQLi} />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Top pelaku (jumlah percobaan SQLi)</h2>
          {offenders.length === 0 ? (
            <Empty>Belum ada serangan pada rentang ini.</Empty>
          ) : (
            <div className="mt-2" style={{ height: Math.max(120, offenders.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={offenders} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap={6}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="who" width={120} tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    stroke="var(--axis)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--grid)", opacity: 0.5 }} />
                  <Bar dataKey="attempts" name="Percobaan" fill="var(--series-1)" radius={[0, 4, 4, 0]}
                    label={{ position: "right", fill: "var(--text-secondary)", fontSize: 11 }} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Live feed</h2>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={onlySqli} onChange={(e) => setOnlySqli(e.target.checked)} />
              Hanya SQLi
            </label>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Waktu</th>
                  <th className="px-3 py-2 font-medium">Pelaku</th>
                  <th className="px-3 py-2 font-medium">Endpoint</th>
                  <th className="px-3 py-2 font-medium">Payload</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 text-right font-medium">Prob.</th>
                </tr>
              </thead>
              <tbody>
                {feed.length === 0 && (
                  <tr><td colSpan={6}><Empty>Menunggu aktivitas…</Empty></td></tr>
                )}
                {feed.map((e) => {
                  const a = actor(e);
                  return (
                    <tr key={e.id} className={`border-t border-slate-100 align-top transition-colors ${flash.has(e.id) ? "bg-red-50" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular text-slate-600">{fmtTime(e.timestamp)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{a.name}</div>
                        <div className="text-slate-500">{a.sub}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{e.endpoint}</td>
                      <td className="max-w-[260px] px-3 py-2">
                        <Link to={`/admin/logs?id=${e.id}`} className="line-clamp-2 break-all font-mono text-slate-800 hover:text-blue-700">
                          {e.raw_payload}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <LabelBadge label={e.label} fp={e.is_false_positive} />
                          {e.label === "SQLi" && <SeverityBadge severity={e.severity} />}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{e.probability.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {posture && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Postur Keamanan ({posture.standard})</h2>
              <p className="text-xs text-stone-500">Kontrol keamanan aktif pada KopiAman untuk mitigasi serangan &amp; pemantauan log.</p>
            </div>
            <Badge tone="green">✓ {posture.controls.length} Kontrol Aktif</Badge>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {posture.controls.map((c) => (
              <div key={c.id} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900">{c.id} · {c.name}</span>
                  <Badge tone="green">Aktif</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">{c.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
