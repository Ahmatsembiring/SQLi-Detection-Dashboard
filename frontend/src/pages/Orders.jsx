import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, fmtDate, rupiah } from "../api";
import { Alert, Badge, Button, Card, Empty, Spinner } from "../components/ui";

export const STATUS = {
  pending: ["yellow", "Menunggu pembayaran"],
  paid: ["blue", "Dibayar"],
  shipped: ["blue", "Dikirim"],
  completed: ["green", "Selesai"],
  cancelled: ["slate", "Dibatalkan"],
};

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const location = useLocation();

  const load = () => api("/api/orders").then(setOrders).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const cancel = async (id) => {
    try {
      await api(`/api/orders/${id}/cancel`, { method: "POST" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!orders) return error ? <Alert>{error}</Alert> : <Spinner />;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Riwayat pesanan</h1>
      {location.state?.justOrdered && <Alert tone="green">Pesanan berhasil dibuat. Terima kasih!</Alert>}
      {error && <Alert>{error}</Alert>}
      {orders.length === 0 && <Empty>Belum ada pesanan.</Empty>}
      {orders.map((o) => (
        <Card key={o.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Pesanan #{o.id}</div>
              <div className="text-xs text-slate-500">{fmtDate(o.created_at)}</div>
            </div>
            <Badge tone={STATUS[o.status][0]}>{STATUS[o.status][1]}</Badge>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between py-1.5">
                <span>{it.product_name} × {it.quantity}</span>
                <span className="tabular">{rupiah(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
            <span className="text-slate-600">Kirim ke: {o.shipping_address}</span>
            <span className="font-semibold">Total {rupiah(o.total)}</span>
          </div>
          {o.status === "pending" && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => cancel(o.id)}>Batalkan</Button>
          )}
        </Card>
      ))}
    </div>
  );
}
