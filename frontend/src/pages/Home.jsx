import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, rupiah } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { Alert, Button, Card, Empty, Pagination, ProductImage, Select, Spinner } from "../components/ui";

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const categoryId = params.get("category") || "";
  const sort = params.get("sort") || "newest";
  const page = Number(params.get("page") || 1);

  const [query, setQuery] = useState(q);
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const { user } = useAuth();
  const { add } = useCart();

  useEffect(() => {
    api("/api/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api("/api/products", { params: { q, category_id: categoryId, sort, page, size: 12 } })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [q, categoryId, sort, page]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  const addToCart = async (p) => {
    try {
      await add(p.id);
      setToast(`${p.name} ditambahkan ke keranjang`);
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-[#3b2112] via-[#5c3317] to-[#7c3f14] p-6 text-amber-50 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-amber-200">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5">Fresh Roast Mingguan</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5">100% Biji Nusantara</span>
          <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-emerald-100">OWASP-Hardened</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Kopi Spesialti Nusantara, Diseduh dengan Aman</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-amber-100/90">
          Jelajahi single origin Arabika, fine Robusta Lampung, house blend espresso, cold brew, hingga alat seduh manual langsung dari roastery kami.
        </p>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() });
          }}
        >
          <input
            aria-label="Cari produk kopi"
            className="w-full rounded-lg bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-300 focus:outline-none"
            placeholder="Cari biji kopi, mis. Aceh Gayo, Robusta Lampung, V60, Cold Brew…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" variant="secondary" className="shrink-0 font-semibold">Cari</Button>
        </form>
      </section>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ category: "" })}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              !categoryId ? "bg-amber-800 text-amber-50" : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            Semua Menu
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => update({ category: String(c.id) })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                String(categoryId) === String(c.id)
                  ? "bg-amber-800 text-amber-50"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Select label="Kategori" value={categoryId} onChange={(e) => update({ category: e.target.value })}>
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="w-48">
            <Select label="Urutkan" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="newest">Terbaru</option>
              <option value="price_asc">Harga terendah</option>
              <option value="price_desc">Harga tertinggi</option>
              <option value="name">Nama A–Z</option>
            </Select>
          </div>
        </div>
        {q && (
          <p className="pb-2 text-sm text-stone-600">
            Hasil untuk “<span className="font-medium">{q}</span>” ·{" "}
            <button className="text-amber-800 hover:underline" onClick={() => { setQuery(""); update({ q: "" }); }}>hapus</button>
          </p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {toast && <Alert tone="green">{toast}</Alert>}

      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty>Produk kopi tidak ditemukan.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.items.map((p) => (
              <Card key={p.id} className="flex flex-col overflow-hidden transition hover:shadow-md">
                <Link to={`/products/${p.id}`}>
                  <ProductImage product={p} className="aspect-square w-full" />
                </Link>
                <div className="flex flex-1 flex-col p-3.5">
                  <span className="text-xs font-medium text-amber-800">{p.category?.name}</span>
                  <Link to={`/products/${p.id}`} className="mt-0.5 line-clamp-2 text-sm font-semibold text-stone-900 hover:text-amber-800">{p.name}</Link>
                  <div className="mt-1.5 font-bold text-stone-900">{rupiah(p.price)}</div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {p.avg_rating ? `★ ${p.avg_rating.toFixed(1)} (${p.review_count})` : "Belum ada ulasan"} · stok {p.stock}
                  </div>
                  {user?.role === "user" && (
                    <Button size="sm" className="mt-auto mt-3" disabled={p.stock === 0} onClick={() => addToCart(p)}>
                      {p.stock === 0 ? "Stok habis" : "+ Keranjang"}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} size={data.size} total={data.total} onPage={(n) => update({ page: String(n) })} />
        </>
      )}
    </div>
  );
}
