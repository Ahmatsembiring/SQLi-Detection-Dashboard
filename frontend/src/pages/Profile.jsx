import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Alert, Button, Card, Input, Textarea } from "../components/ui";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "", address: user.address || "" });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    try {
      setUser(await api("/api/profile", { method: "PATCH", body: form }));
      setMsg({ tone: "green", text: "Profil disimpan." });
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api("/api/profile/password", { method: "POST", body: pw });
      setPw({ old_password: "", new_password: "" });
      setMsg({ tone: "green", text: "Password diganti." });
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card className="p-5">
        <form onSubmit={save} className="space-y-3">
          <Input label="Email" value={user.email} disabled />
          <Input label="Nama" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="No. HP" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea label="Alamat" rows={3} maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Button type="submit">Simpan</Button>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Ganti password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <Input label="Password lama" type="password" required value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} />
          <Input label="Password baru (min. 8 karakter)" type="password" required minLength={8} value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          <Button type="submit" variant="secondary">Ganti password</Button>
        </form>
      </Card>
    </div>
  );
}
