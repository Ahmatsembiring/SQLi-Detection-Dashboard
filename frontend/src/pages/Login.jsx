import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { Alert, Button, Card, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      navigate(location.state?.from || (user.role === "admin" ? "/admin" : "/"), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

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
            KopiAman Roastery · Dataran Tinggi Nusantara
          </span>
          <h2 className="font-display text-3xl font-bold leading-tight text-amber-50 drop-shadow-sm">
            Nikmati Hangatnya Seduhan Kopi dari Kebun Pilihan
          </h2>
          <p className="text-sm leading-relaxed text-amber-100/90">
            Masuk ke akun KopiAman untuk menyimpan keranjang, memantau status pesanan, dan menulis ulasan cita rasa kopi favoritmu dengan perlindungan keamanan OWASP.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-sm border-amber-100/40 bg-[#fffdf9]/95 p-5 shadow-[0_20px_50px_rgba(18,9,4,0.45)] backdrop-blur-md sm:p-6 lg:col-span-6">
          <h1 className="font-display mb-1 text-2xl font-bold text-stone-900">Masuk</h1>
          <p className="mb-4 text-xs text-stone-500">Selamat datang kembali di KopiAman Roastery.</p>
          <form onSubmit={submit} className="space-y-3">
            {/* type="text" (not "email") on purpose: the field is a monitored free-text input point. */}
            <Input label="Email" name="email" type="text" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password" name="password" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Button>
          </form>
          <div className="mt-3">
            <GoogleAuthButton
              mode="signin"
              onSuccess={(user) => navigate(location.state?.from || (user.role === "admin" ? "/admin" : "/"), { replace: true })}
              onError={setError}
            />
          </div>
          <p className="mt-4 text-center text-sm text-stone-600">
            Belum punya akun? <Link to="/register" className="font-medium text-amber-800 hover:underline">Daftar</Link>
          </p>
        </Card>
      </div>
    </section>
  );
}
