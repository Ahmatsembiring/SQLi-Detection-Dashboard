import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, fmtDate, rupiah } from "../api";
import FeaturedPromo from "../components/FeaturedPromo";
import { Alert, Badge, Button, Card, Spinner } from "../components/ui";

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
      {orders.length === 0 && (
        <div className="space-y-6">
          <Card className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-900">
              ☕
            </div>
            <h2 className="mt-3 text-lg font-bold text-stone-900">Belum Ada Riwayat Pesanan</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
              Kamu belum pernah melakukan pemesanan. Coba nikmati racikan kopi spesialti unggulan KopiAman di bawah ini!
            </p>
            <div className="mt-4">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-900"
              >
                Mulai Pesan Kopi
              </Link>
            </div>
          </Card>
          <FeaturedPromo
            title="Mulai Pesanan Pertamamu dengan Produk Unggulan"
            subtitle="Biji kopi pilihan Nusantara & menu favorit pelanggan KopiAman."
          />
        </div>
      )}
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
