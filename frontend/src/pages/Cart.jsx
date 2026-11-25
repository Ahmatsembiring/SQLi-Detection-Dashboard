import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, rupiah } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import FeaturedPromo from "../components/FeaturedPromo";
import { Alert, Button, Card, ProductImage, Textarea } from "../components/ui";

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
    return (
      <div className="space-y-6">
        <Card className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-900">
            ☕
          </div>
          <h1 className="mt-3 text-lg font-bold text-stone-900">Keranjang Kopi Masih Kosong</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
            Belum ada produk di keranjangmu. Yuk pilih biji kopi spesialti, cold brew, atau alat seduh favoritmu dari rekomendasi di bawah ini!
          </p>
          <div className="mt-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-900"
            >
              Jelajahi Menu Kopi
            </Link>
          </div>
        </Card>
        <FeaturedPromo
          title="Rekomendasi Kopi Unggulan untuk Keranjangmu"
          subtitle="Fresh roasted mingguan — klik '+ Keranjang' langsung untuk mulai memesan."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <h1 className="text-xl font-bold">Keranjang Kopi</h1>
        {items.map((it) => (
          <Card key={it.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
            <ProductImage product={it.product} className="h-14 w-14 shrink-0 rounded-lg text-base sm:h-16 sm:w-16" />
            <div className="min-w-0 flex-1">
              <Link to={`/products/${it.product.id}`} className="block truncate font-medium hover:text-amber-800">{it.product.name}</Link>
              <div className="text-sm text-stone-600">{rupiah(it.product.price)}</div>
            </div>
            <div className="flex w-full items-center justify-between gap-2 border-t border-stone-100 pt-2 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" aria-label="Kurangi" disabled={it.quantity <= 1} onClick={() => update(it.id, it.quantity - 1)}>−</Button>
                <span className="w-8 text-center tabular">{it.quantity}</span>
                <Button size="sm" variant="secondary" aria-label="Tambah" disabled={it.quantity >= it.product.stock} onClick={() => update(it.id, it.quantity + 1)}>+</Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>Hapus</Button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="h-fit space-y-3 p-4">
        <h2 className="font-semibold">Checkout</h2>
        <div className="flex justify-between text-lg"><span>Total</span><span className="font-bold">{rupiah(total)}</span></div>
        <form onSubmit={checkout} className="space-y-3">
          <Textarea label="Alamat pengiriman" rows={3} required minLength={5} maxLength={500} value={address}
            onChange={(e) => setAddress(e.target.value)} placeholder="Jl. …, kota, kode pos" />
          <Textarea label="Catatan gilingan / pengiriman (opsional)" rows={2} maxLength={500} value={note}
            onChange={(e) => setNote(e.target.value)} placeholder="Mis. Whole bean / giling medium untuk V60" />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Buat pesanan"}</Button>
        </form>
      </Card>
    </div>
  );
}
