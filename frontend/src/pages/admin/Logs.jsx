import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, download, fmtDate } from "../../api";
import { Alert, Button, Card, Empty, Input, LabelBadge, Modal, Pagination, Select, SeverityBadge, Spinner } from "../../components/ui";

const EMPTY = { date_from: "", date_to: "", user: "", label: "SQLi", ip: "", include_fp: "true" };

function toParams(f) {
  return {
    ...f,
    date_from: f.date_from ? new Date(f.date_from).toISOString() : undefined,
    date_to: f.date_to ? new Date(f.date_to).toISOString() : undefined,
  };
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children ?? "–"}</dd>
    </div>
  );
}

export function LogDetail({ log, onChange }) {
  const [busy, setBusy] = useState(false);
  const toggleFp = async () => {
    setBusy(true);
    try {
      onChange(await api(`/api/monitor/logs/${log.id}/false-positive`, { method: "PATCH", body: { is_false_positive: !log.is_false_positive } }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Waktu query">{fmtDate(log.timestamp)}</Field>
        <Field label="Pengguna">{log.username || (log.attempted_username ? `anonim (${log.attempted_username})` : "anonim")}</Field>
        <Field label="User ID / sesi">{log.user_id ?? "–"} / <span className="font-mono">{log.session_id || "–"}</span></Field>
        <Field label="IP">{log.ip}</Field>
        <Field label="Endpoint"><span className="font-mono">{log.endpoint}</span></Field>
        <Field label="Label"><LabelBadge label={log.label} fp={log.is_false_positive} /></Field>
        <Field label="Probabilitas SQLi"><span className="tabular">{log.probability.toFixed(4)}</span></Field>
        <Field label="Severity"><SeverityBadge severity={log.severity} /></Field>
        <Field label="Latensi model / pipeline"><span className="tabular">{log.latency_ms.toFixed(2)} ms / {log.pipeline_delay_ms?.toFixed(1) ?? "–"} ms</span></Field>
      </dl>
      <div>
        <div className="text-xs font-medium text-slate-500">Payload mentah (nilai parameter dari log DB)</div>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{log.raw_payload}</pre>
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500">Setelah normalisasi (input model)</div>
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{log.normalized_payload}</pre>
      </div>
      {log.query_text && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Query SQL yang tercatat (parameterized)</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{log.query_text}</pre>
        </details>
      )}
      <Button variant={log.is_false_positive ? "secondary" : "danger"} disabled={busy} onClick={toggleFp}>
        {log.is_false_positive ? "Batalkan tanda false positive" : "Tandai sebagai false positive"}
      </Button>
    </div>
  );
}

export default function Logs() {
  const [params, setParams] = useSearchParams();
  const initial = { ...EMPTY, user: params.get("user") || "" };
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api("/api/monitor/logs", { params: { ...toParams(applied), page, size: 25 } })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [applied, page]);

  useEffect(() => {
    const id = params.get("id");
    if (id) api(`/api/monitor/logs/${id}`).then(setDetail).catch(() => {});
  }, [params]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const closeDetail = () => {
    setDetail(null);
    if (params.get("id")) setParams({});
  };
  const onChange = (updated) => {
    setDetail(updated);
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) });
  };
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Log deteksi</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download("/api/monitor/export.csv", toParams(applied), `sqli-report-${stamp}.csv`)}>Ekspor CSV</Button>
          <Button variant="secondary" onClick={() => download("/api/monitor/export.pdf", toParams(applied), `sqli-report-${stamp}.pdf`)}>Ekspor PDF</Button>
          <Button variant="ghost" onClick={() => download("/api/monitor/false-positives.csv", {}, "false_positives.csv")}>Data FP (retrain)</Button>
        </div>
      </div>

      <Card className="p-4">
        <form
          className="grid grid-cols-2 gap-3 md:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied(filters);
          }}
        >
          <Input label="Dari" type="datetime-local" value={filters.date_from} onChange={set("date_from")} />
          <Input label="Sampai" type="datetime-local" value={filters.date_to} onChange={set("date_to")} />
          <Input label="Pengguna" placeholder="nama / email" value={filters.user} onChange={set("user")} />
          <Input label="IP" value={filters.ip} onChange={set("ip")} />
          <Select label="Label" value={filters.label} onChange={set("label")}>
            <option value="">Semua</option>
            <option value="SQLi">SQLi</option>
            <option value="Normal">Normal</option>
          </Select>
          <Select label="False positive" value={filters.include_fp} onChange={set("include_fp")}>
            <option value="true">Tampilkan</option>
            <option value="false">Sembunyikan</option>
          </Select>
          <div className="col-span-2 flex gap-2 md:col-span-6">
            <Button type="submit">Terapkan filter</Button>
            <Button type="button" variant="ghost" onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); }}>Reset</Button>
          </div>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto">
        {!data ? <Spinner /> : data.items.length === 0 ? <Empty>Tidak ada data untuk filter ini.</Empty> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Waktu</th>
                <th className="px-3 py-2 font-medium">Pengguna</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Payload</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 text-right font-medium">Prob.</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50" onClick={() => setDetail(l)}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular text-slate-600">{fmtDate(l.timestamp)}</td>
                  <td className="px-3 py-2">{l.username || <span className="text-slate-500">anonim{l.attempted_username ? ` (${l.attempted_username.slice(0, 20)})` : ""}</span>}</td>
                  <td className="px-3 py-2 text-xs">{l.ip}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{l.endpoint}</td>
                  <td className="max-w-xs px-3 py-2"><span className="line-clamp-2 break-all font-mono text-xs">{l.raw_payload}</span></td>
                  <td className="px-3 py-2"><LabelBadge label={l.label} fp={l.is_false_positive} /></td>
                  <td className="px-3 py-2 text-right tabular">{l.probability.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {data && <Pagination page={page} size={data.size} total={data.total} onPage={setPage} />}

      <Modal open={!!detail} onClose={closeDetail} title={detail ? `Deteksi #${detail.id}` : ""} wide>
        {detail && <LogDetail log={detail} onChange={onChange} />}
      </Modal>
    </div>
  );
}
