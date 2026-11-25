import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, rupiah } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { Alert, Badge, Button, Card, ProductImage } from "./ui";

export default function FeaturedPromo({ title = "Produk Unggulan KopiAman", subtitle = "Rekomendasi pilihan roaster untuk menemani harimu." }) {
  const { user } = useAuth();
  const { add } = useCart();
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api("/api/products", { params: { size: 4, sort: "newest" } })
      .then((res) => setItems(res.items || []))
      .catch(() => {});
  }, []);

  const quickAdd = async (p) => {
    try {
      await add(p.id, 1);
      setToast(`${p.name} ditambahkan ke keranjang!`);
      setTimeout(() => setToast(""), 2500);
    } catch {
      /* ignore */
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-[#3b2112] via-[#5c3317] to-[#854d0e] p-5 text-amber-50 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="yellow" className="bg-amber-200/20 text-amber-100">★ Promo &amp; Pilihan Roaster</Badge>
            <h2 className="mt-2 text-lg font-bold sm:text-xl">{title}</h2>
            <p className="mt-0.5 text-xs text-amber-100/90 sm:text-sm">{subtitle}</p>
          </div>
          <Link
            to="/"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-100 px-4 py-2 text-xs font-semibold text-[#3b2112] transition hover:bg-white sm:text-sm"
          >
            Lihat Semua Menu →
          </Link>
        </div>
      </div>

      {toast && (
        <Alert tone="green">
          {toast}{" "}
          <Link to="/cart" className="font-semibold underline">Buka keranjang</Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {items.map((p) => (
          <Card key={p.id} className="group flex flex-col overflow-hidden transition hover:shadow-md">
            <Link to={`/products/${p.id}`}>
              <ProductImage product={p} className="aspect-[4/3] w-full" />
            </Link>
            <div className="flex flex-1 flex-col p-3">
              <span className="text-[11px] font-medium text-amber-800">{p.category?.name}</span>
              <Link to={`/products/${p.id}`} className="mt-0.5 line-clamp-2 text-sm font-semibold text-stone-900 hover:text-amber-800">
                {p.name}
              </Link>
              <div className="mt-1.5 font-bold text-stone-900">{rupiah(p.price)}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">
                {p.avg_rating ? `★ ${p.avg_rating.toFixed(1)} (${p.review_count})` : "Fresh Roast"} · stok {p.stock}
              </div>
              {user?.role === "user" && (
                <Button size="sm" className="mt-3 w-full" disabled={p.stock === 0} onClick={() => quickAdd(p)}>
                  {p.stock === 0 ? "Stok habis" : "+ Keranjang"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
