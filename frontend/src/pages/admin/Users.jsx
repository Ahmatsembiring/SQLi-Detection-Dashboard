import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, Card, Input, Spinner } from "../../components/ui";

const RISK = { High: ["red", "▲ Tinggi"], Medium: ["orange", "◆ Sedang"], Low: ["yellow", "▼ Rendah"], None: ["slate", "– Tidak ada"] };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const load = () => api("/api/monitor/risk").then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id, status) => {
    try {
      await api(`/api/admin/users/${id}/status`, { method: "PATCH", body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!rows) return <Spinner />;
  const needle = q.toLowerCase();
  const shown = rows.filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Pengguna & profil risiko</h1>
          <p className="text-sm text-slate-500">Dihitung dari deteksi SQLi yang tidak ditandai false positive.</p>
        </div>
        <div className="w-64"><Input placeholder="Cari nama / email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Pengguna</th>
              <th className="px-3 py-2 text-right font-medium">Input dipantau</th>
              <th className="px-3 py-2 text-right font-medium">Percobaan SQLi</th>
              <th className="px-3 py-2 text-right font-medium">Skor rata-rata</th>
              <th className="px-3 py-2 font-medium">Terakhir</th>
              <th className="px-3 py-2 font-medium">Risiko</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.user_id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2 text-right tabular">{r.monitored_inputs}</td>
                <td className="px-3 py-2 text-right tabular">
                  {r.attempts > 0 ? <Link className="text-blue-600 hover:underline" to={`/admin/logs?user=${encodeURIComponent(r.email)}`}>{r.attempts}</Link> : 0}
                </td>
                <td className="px-3 py-2 text-right tabular">{r.attempts ? r.avg_score.toFixed(2) : "–"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.last_attempt ? fmtDate(r.last_attempt) : "–"}</td>
                <td className="px-3 py-2"><Badge tone={RISK[r.risk][0]}>{RISK[r.risk][1]}</Badge></td>
                <td className="px-3 py-2">
                  <Badge tone={r.status === "active" ? "green" : "red"}>{r.status === "active" ? "● Aktif" : "⛔ Diblokir"}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  {r.user_id !== me.id && (
                    r.status === "active"
                      ? <Button size="sm" variant="danger" onClick={() => setStatus(r.user_id, "suspended")}>Blokir</Button>
                      : <Button size="sm" variant="secondary" onClick={() => setStatus(r.user_id, "active")}>Aktifkan</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
