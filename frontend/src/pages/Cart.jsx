import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, rupiah } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { Alert, Button, Card, Empty, ProductImage, Textarea } from "../components/ui";

export default function Cart() {
  const { user } = useAuth();
  const { items, total, update, remove, refresh } = useCart();
  const [address, setAddress] = useState(user?.address || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const checkout = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/orders", { method: "POST", body: { shipping_address: address, note: note || null } });
      await refresh();
      navigate("/orders", { state: { justOrdered: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return <Empty>Keranjang kosong. <Link to="/" className="text-blue-600 hover:underline">Mulai belanja</Link></Empty>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <h1 className="text-xl font-bold">Keranjang</h1>
        {items.map((it) => (
          <Card key={it.id} className="flex items-center gap-3 p-3">
            <ProductImage product={it.product} className="h-16 w-16 shrink-0 rounded-lg text-base" />
            <div className="min-w-0 flex-1">
              <Link to={`/products/${it.product.id}`} className="block truncate font-medium hover:text-blue-700">{it.product.name}</Link>
              <div className="text-sm text-slate-600">{rupiah(it.product.price)}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" aria-label="Kurangi" disabled={it.quantity <= 1} onClick={() => update(it.id, it.quantity - 1)}>−</Button>
              <span className="w-8 text-center tabular">{it.quantity}</span>
              <Button size="sm" variant="secondary" aria-label="Tambah" disabled={it.quantity >= it.product.stock} onClick={() => update(it.id, it.quantity + 1)}>+</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>Hapus</Button>
          </Card>
        ))}
      </div>
      <Card className="h-fit space-y-3 p-4">
        <h2 className="font-semibold">Checkout</h2>
        <div className="flex justify-between text-lg"><span>Total</span><span className="font-bold">{rupiah(total)}</span></div>
        <form onSubmit={checkout} className="space-y-3">
          <Textarea label="Alamat pengiriman" rows={3} required minLength={5} maxLength={500} value={address}
            onChange={(e) => setAddress(e.target.value)} placeholder="Jl. …, kota, kode pos" />
          <Textarea label="Catatan (opsional)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Buat pesanan"}</Button>
        </form>
      </Card>
    </div>
  );
}
