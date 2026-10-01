import { useEffect, useState } from "react";
import { api, rupiah } from "../../api";
import { Alert, Badge, Button, Card, Input, Modal, Select, Spinner, Textarea } from "../../components/ui";

const BLANK = { name: "", description: "", price: "", stock: 0, category_id: "", image_url: "", is_active: true };

export default function Products() {
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = () => api("/api/admin/products", { params: { q } }).then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api("/api/categories").then(setCategories);
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...editing, price: String(editing.price), stock: Number(editing.stock),
      category_id: editing.category_id ? Number(editing.category_id) : null, image_url: editing.image_url || null };
    delete body.id;
    try {
      if (editing.id) await api(`/api/admin/products/${editing.id}`, { method: "PUT", body });
      else await api("/api/admin/products", { method: "POST", body });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (p) => {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
    load();
  };

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-bold">Produk</h1>
        <div className="flex gap-2">
          <form onSubmit={(e) => { e.preventDefault(); load(); }}><Input placeholder="Cari produk" value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <Button onClick={() => setEditing(BLANK)}>+ Produk baru</Button>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto">
        {!items ? <Spinner /> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 text-right font-medium">Harga</th>
                <th className="px-3 py-2 text-right font-medium">Stok</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-slate-600">{p.category?.name || "–"}</td>
                  <td className="px-3 py-2 text-right tabular">{rupiah(p.price)}</td>
                  <td className="px-3 py-2 text-right tabular">{p.stock}</td>
                  <td className="px-3 py-2">{p.is_active ? <Badge tone="green">● Aktif</Badge> : <Badge>○ Nonaktif</Badge>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ ...p, category_id: p.category_id ?? "", image_url: p.image_url ?? "", description: p.description ?? "" })}>Ubah</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => remove(p)}>Hapus</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Ubah produk" : "Produk baru"}>
        {editing && (
          <form onSubmit={save} className="space-y-3">
            <Input label="Nama" required maxLength={200} value={editing.name} onChange={set("name")} />
            <Textarea label="Deskripsi" rows={3} value={editing.description} onChange={set("description")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Harga (Rp)" type="number" min={0} step="100" required value={editing.price} onChange={set("price")} />
              <Input label="Stok" type="number" min={0} required value={editing.stock} onChange={set("stock")} />
            </div>
            <Select label="Kategori" value={editing.category_id} onChange={set("category_id")}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="URL gambar (opsional)" type="url" value={editing.image_url} onChange={set("image_url")} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={set("is_active")} /> Aktif (tampil di toko)</label>
            <Button type="submit">Simpan</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
