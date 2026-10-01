import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
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
    <Card className="mx-auto mt-6 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">Daftar akun</h1>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nama lengkap" name="name" required maxLength={100} value={form.name} onChange={set("name")} />
        <Input label="Email" name="email" type="email" required value={form.email} onChange={set("email")} />
        <Input label="Password (min. 8 karakter)" name="password" type="password" required minLength={8}
          autoComplete="new-password" value={form.password} onChange={set("password")} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : "Daftar"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Sudah punya akun? <Link to="/login" className="text-blue-600 hover:underline">Masuk</Link>
      </p>
    </Card>
  );
}
