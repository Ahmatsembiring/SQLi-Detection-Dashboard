import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
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
    <Card className="mx-auto mt-6 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">Masuk</h1>
      <form onSubmit={submit} className="space-y-3">
        {/* type="text" (not "email") on purpose: the field is a monitored free-text input point. */}
        <Input label="Email" name="email" type="text" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-600">
        Belum punya akun? <Link to="/register" className="text-amber-800 hover:underline">Daftar</Link>
      </p>
    </Card>
  );
}
