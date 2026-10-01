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
      <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
        <h1 className="text-2xl font-bold">Belanja aman, mudah, dan cepat</h1>
        <p className="mt-1 text-blue-100">Produk lokal pilihan dari Lampung dan seluruh Indonesia.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() });
          }}
        >
          <input
            aria-label="Cari produk"
            className="w-full rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-200 focus:outline-none bg-white"
            placeholder="Cari produk, mis. kopi lampung, kemeja flanel…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" variant="secondary">Cari</Button>
        </form>
      </section>

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
        {q && (
          <p className="pb-2 text-sm text-slate-600">
            Hasil untuk “<span className="font-medium">{q}</span>” ·{" "}
            <button className="text-blue-600 hover:underline" onClick={() => { setQuery(""); update({ q: "" }); }}>hapus</button>
          </p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {toast && <Alert tone="green">{toast}</Alert>}

      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty>Produk tidak ditemukan.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.items.map((p) => (
              <Card key={p.id} className="flex flex-col overflow-hidden">
                <Link to={`/products/${p.id}`}>
                  <ProductImage product={p} className="aspect-square w-full" />
                </Link>
                <div className="flex flex-1 flex-col p-3">
                  <span className="text-xs text-slate-500">{p.category?.name}</span>
                  <Link to={`/products/${p.id}`} className="line-clamp-2 text-sm font-medium hover:text-blue-700">{p.name}</Link>
                  <div className="mt-1 font-semibold">{rupiah(p.price)}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {p.avg_rating ? `★ ${p.avg_rating.toFixed(1)} (${p.review_count})` : "Belum ada ulasan"} · stok {p.stock}
                  </div>
                  {user?.role === "user" && (
                    <Button size="sm" className="mt-auto pt-1" disabled={p.stock === 0} onClick={() => addToCart(p)}>
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
