import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fmtDate, rupiah } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { Alert, Button, Card, Empty, ProductImage, Select, Spinner, Textarea } from "../components/ui";

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState(null);

  const load = () => {
    api(`/api/products/${id}`).then(setProduct).catch((e) => setMsg({ tone: "red", text: e.message }));
    api(`/api/products/${id}/reviews`).then(setReviews).catch(() => {});
  };
  useEffect(load, [id]);

  if (!product) return msg ? <Alert>{msg.text}</Alert> : <Spinner />;

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/products/${id}/reviews`, { method: "POST", body: { rating: Number(rating), comment } });
      setComment("");
      setMsg({ tone: "green", text: "Terima kasih, ulasan Anda tersimpan." });
      load();
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">← Kembali belanja</Link>
      <Card className="grid gap-6 p-5 md:grid-cols-2">
        <ProductImage product={product} className="aspect-square w-full rounded-xl" />
        <div className="space-y-3">
          <span className="text-sm text-slate-500">{product.category?.name}</span>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="text-2xl font-semibold text-blue-700">{rupiah(product.price)}</div>
          <div className="text-sm text-slate-600">
            {product.avg_rating ? `★ ${product.avg_rating.toFixed(1)} dari ${product.review_count} ulasan` : "Belum ada ulasan"} · stok {product.stock}
          </div>
          <p className="text-slate-700">{product.description}</p>
          {user?.role === "user" ? (
            <div className="flex items-end gap-2">
              <div className="w-24">
                <Select label="Jumlah" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                  {Array.from({ length: Math.min(10, product.stock) }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
                </Select>
              </div>
              <Button
                disabled={product.stock === 0}
                onClick={async () => {
                  await add(product.id, qty);
                  navigate("/cart");
                }}
              >
                Beli sekarang
              </Button>
            </div>
          ) : !user ? (
            <p className="text-sm text-slate-600"><Link to="/login" className="text-blue-600 hover:underline">Masuk</Link> untuk membeli.</p>
          ) : null}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ulasan pembeli</h2>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {user?.role === "user" && (
          <Card className="p-4">
            <form onSubmit={submitReview} className="space-y-3">
              <div className="w-32">
                <Select label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </Select>
              </div>
              <Textarea label="Ulasan" rows={3} required maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Bagaimana kualitas produknya?" />
              <Button type="submit">Kirim ulasan</Button>
            </form>
          </Card>
        )}
        {reviews.length === 0 ? (
          <Empty>Belum ada ulasan untuk produk ini.</Empty>
        ) : (
          reviews.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{r.user_name}</span>
                <span className="text-slate-500">{fmtDate(r.created_at)}</span>
              </div>
              <div className="text-amber-500" aria-label={`${r.rating} dari 5`}>{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></div>
              {/* React escapes text content, so stored payloads are rendered as plain text. */}
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{r.comment}</p>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
