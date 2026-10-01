import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, Button, Card, Input } from "../../components/ui";

export default function Categories() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/api/categories").then(setItems);
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editId) await api(`/api/admin/categories/${editId}`, { method: "PUT", body: form });
      else await api("/api/admin/categories", { method: "POST", body: form });
      setForm({ name: "", description: "" });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Hapus kategori "${c.name}"? Produk di dalamnya menjadi tanpa kategori.`)) return;
    await api(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Kategori</h1>
      <Card className="p-4">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
          <Input label="Nama" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Deskripsi" maxLength={1000} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit">{editId ? "Simpan" : "+ Tambah"}</Button>
            {editId && <Button type="button" variant="ghost" onClick={() => { setEditId(null); setForm({ name: "", description: "" }); }}>Batal</Button>}
          </div>
        </form>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </Card>
      <Card>
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500">{c.description}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setEditId(c.id); setForm({ name: c.name, description: c.description || "" }); }}>Ubah</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c)}>Hapus</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
