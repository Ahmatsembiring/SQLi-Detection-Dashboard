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
    <div className="w-full">
      <section className="relative w-full overflow-hidden border-b border-amber-200/15 bg-[#23140c] text-amber-50 shadow-[0_12px_36px_rgba(35,20,12,0.20)]">
        <div
          aria-hidden="true"
          className="animate-hero-zoom absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(110deg, rgba(28, 15, 8, 0.90) 0%, rgba(56, 30, 15, 0.80) 55%, rgba(30, 16, 8, 0.68) 100%), url('/images/coffee/espresso-blend.jpg')",
          }}
        />
        <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="animate-fade-up flex flex-wrap items-center gap-2 text-xs font-medium text-amber-200">
            <span className="rounded-full border border-amber-200/25 bg-black/25 px-3 py-0.5 backdrop-blur-sm">Fresh Roast Mingguan</span>
            <span className="rounded-full border border-amber-200/25 bg-black/25 px-3 py-0.5 backdrop-blur-sm">100% Biji Nusantara</span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-3 py-0.5 text-emerald-100 backdrop-blur-sm">OWASP-Hardened</span>
          </div>
          <h1
            className="animate-fade-up font-display mt-3.5 max-w-3xl text-2xl font-bold tracking-tight text-amber-50 sm:text-3xl md:text-4xl"
            style={{ animationDelay: "80ms" }}
          >
            Kopi Spesialti Nusantara, Diseduh dengan Elegan &amp; Aman
          </h1>
          <p
            className="animate-fade-up mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/90 md:text-base"
            style={{ animationDelay: "150ms" }}
          >
            Jelajahi single origin Arabika, fine Robusta Lampung, house blend espresso, cold brew, hingga alat seduh manual langsung dari roastery kami — tanpa perlu login untuk melihat katalog.
          </p>
          <form
            className="animate-fade-up mt-6 flex max-w-2xl gap-2"
            style={{ animationDelay: "220ms" }}
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: query.trim() });
            }}
          >
            <input
              aria-label="Cari produk kopi"
              className="w-full rounded-xl border border-amber-200/30 bg-white/95 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:ring-2 focus:ring-amber-300 focus:outline-none"
              placeholder="Cari biji kopi, mis. Aceh Gayo, Robusta Lampung, V60, Cold Brew…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" className="shrink-0 rounded-xl bg-amber-500 px-5 font-semibold text-[#22140c] hover:bg-amber-400">
              Cari
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3.5">
          <div className="text-xs font-bold text-amber-900">Roasting Segar Mingguan</div>
          <p className="mt-0.5 text-xs text-stone-600">Setiap batch dipanggang terbatas dan dikemas dengan one-way valve bag.</p>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs font-bold text-amber-900">Biji Pilihan Nusantara</div>
          <p className="mt-0.5 text-xs text-stone-600">Langsung dari petani Aceh Gayo, Toraja, Flores, Kintamani, hingga Lampung.</p>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs font-bold text-amber-900">Keamanan OWASP &amp; Monitoring</div>
          <p className="mt-0.5 text-xs text-stone-600">Seluruh input publik &amp; transaksi terlindungi ORM dan dipantau real-time.</p>
        </Card>
      </section>

      {categories.length > 0 && (
        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          <button
            type="button"
            onClick={() => update({ category: "" })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
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
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-56">
            <Select label="Kategori" value={categoryId} onChange={(e) => update({ category: e.target.value })}>
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="w-full sm:w-48">
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.items.map((p, idx) => (
              <Card
                key={p.id}
                style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
                className="animate-fade-up group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(45,26,14,0.14)]"
              >
                <Link to={`/products/${p.id}`}>
                  <ProductImage product={p} className="aspect-[4/3] w-full" />
                </Link>
                <div className="flex flex-1 flex-col p-3">
                  <span className="text-[11px] font-medium text-amber-800">{p.category?.name}</span>
                  <Link to={`/products/${p.id}`} className="mt-0.5 line-clamp-2 text-sm font-semibold text-stone-900 hover:text-amber-800">{p.name}</Link>
                  <div className="mt-1.5 text-sm font-bold text-stone-900">{rupiah(p.price)}</div>
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    {p.avg_rating ? `★ ${p.avg_rating.toFixed(1)} (${p.review_count})` : "Belum ada ulasan"} · stok {p.stock}
                  </div>
                  {user?.role === "user" && (
                    <Button size="sm" className="mt-auto mt-2.5 w-full" disabled={p.stock === 0} onClick={() => addToCart(p)}>
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
    </div>
  );
}
