import { useEffect, useState } from "react";
import { api, fmtDate, rupiah } from "../../api";
import { Alert, Badge, Card, Empty, Select, Spinner } from "../../components/ui";
import { STATUS } from "../Orders";

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const load = () => api("/api/admin/orders", { params: { status: filter } }).then(setOrders).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [filter]);

  const setStatus = async (id, status) => {
    try {
      const updated = await api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status } });
      setOrders((os) => os.map((o) => (o.id === id ? updated : o)));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-bold">Pesanan</h1>
        <div className="w-48">
          <Select label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Semua</option>
            {Object.entries(STATUS).map(([k, [, label]]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {!orders ? <Spinner /> : orders.length === 0 ? <Empty>Tidak ada pesanan.</Empty> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Pembeli</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Tanggal</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 tabular">{o.id}</td>
                  <td className="px-3 py-2"><div className="font-medium">{o.user_name}</div><div className="text-xs text-slate-500">{o.user_email}</div></td>
                  <td className="px-3 py-2 text-xs">{o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}</td>
                  <td className="px-3 py-2 text-right tabular">{rupiah(o.total)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(o.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS[o.status][0]}>{STATUS[o.status][1]}</Badge>
                      <select aria-label="Ubah status" className="rounded border border-slate-300 px-1 py-0.5 text-xs" value={o.status}
                        onChange={(e) => setStatus(o.id, e.target.value)}>
                        {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
