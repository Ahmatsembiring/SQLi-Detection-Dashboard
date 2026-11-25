import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { Alert, Button, Card, Input } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <section
      className="relative -mx-4 -my-5 flex min-h-[calc(100vh-140px)] items-center justify-center overflow-hidden px-4 py-10 sm:-my-7 sm:rounded-3xl sm:mx-0"
      style={{
        backgroundImage:
          "linear-gradient(120deg, rgba(24, 13, 7, 0.72) 0%, rgba(44, 24, 12, 0.56) 50%, rgba(24, 13, 7, 0.78) 100%), url('/images/coffee/plantation-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 grid w-full max-w-4xl items-center gap-8 lg:grid-cols-12">
        <div className="hidden space-y-4 text-amber-50 lg:col-span-6 lg:block">
          <span className="inline-block rounded-full border border-amber-200/30 bg-black/30 px-3.5 py-1 text-xs font-medium tracking-wide text-amber-200 backdrop-blur-sm">
            Bergabung dengan Komunitas KopiAman
          </span>
          <h2 className="font-display text-3xl font-bold leading-tight text-amber-50 drop-shadow-sm">
            Dari Perkebunan Kopi Nusantara Langsung ke Cangkirmu
          </h2>
          <p className="text-sm leading-relaxed text-amber-100/90">
            Daftar gratis menggunakan email atau akun Gmail untuk menikmati kopi spesialti fresh-roast dengan transaksi yang aman dan terpantau.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-sm border-amber-100/40 bg-[#fffdf9]/95 p-5 shadow-[0_20px_50px_rgba(18,9,4,0.45)] backdrop-blur-md sm:p-6 lg:col-span-6">
          <h1 className="font-display mb-1 text-2xl font-bold text-stone-900">Daftar Akun</h1>
          <p className="mb-4 text-xs text-stone-500">Buat akun baru atau daftar instan dengan Gmail.</p>
          <form onSubmit={submit} className="space-y-3">
            <Input label="Nama lengkap" name="name" required maxLength={100} value={form.name} onChange={set("name")} />
            <Input label="Email" name="email" type="email" required value={form.email} onChange={set("email")} />
            <Input label="Password (min. 8 karakter, huruf besar, kecil & angka)" name="password" type="password" required minLength={8}
              autoComplete="new-password" value={form.password} onChange={set("password")} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Daftar"}</Button>
          </form>
          <div className="mt-3">
            <GoogleAuthButton mode="signup" onSuccess={() => navigate("/")} onError={setError} />
          </div>
          <p className="mt-4 text-center text-sm text-stone-600">
            Sudah punya akun? <Link to="/login" className="font-medium text-amber-800 hover:underline">Masuk</Link>
          </p>
        </Card>
      </div>
    </section>
  );
}
