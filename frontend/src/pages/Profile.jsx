import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtDate } from "../api";
import { useAuth } from "../auth";
import { Alert, Badge, Button, Card, Input, Textarea } from "../components/ui";

function initialsOf(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "K";
}

/** Resize an uploaded image file to a crisp 256x256 center-cropped JPEG data URL. */
function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Format foto harus JPG, PNG, atau WebP."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Ukuran file maksimal 5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Gagal membaca gambar."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    address: user.address || "",
    bio: user.bio || "",
    avatar_url: user.avatar_url || "",
  });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    try {
      const dataUrl = await resizeAvatar(file);
      setForm((f) => ({ ...f, avatar_url: dataUrl }));
      setMsg({ tone: "blue", text: "Foto dipilih. Klik 'Simpan Perubahan' untuk menyimpan ke akun Anda." });
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updated = await api("/api/profile", {
        method: "PATCH",
        body: {
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          bio: form.bio || null,
          avatar_url: form.avatar_url || null,
        },
      });
      setUser(updated);
      setMsg({ tone: "green", text: "Profil dan foto berhasil diperbarui." });
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/profile/password", { method: "POST", body: pw });
      setPw({ old_password: "", new_password: "" });
      setMsg({ tone: "green", text: "Password berhasil diganti." });
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="animate-fade-up mx-auto max-w-2xl space-y-5">
      {/* Profile Hero Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#3b2112] via-[#5c3317] to-[#854d0e]" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#4a2c1a] shadow-md">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt={user.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-amber-100">
                    {initialsOf(form.name || user.name)}
                  </div>
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-lg font-bold text-stone-900 sm:text-xl">{user.name}</h1>
                <p className="text-xs text-stone-500 sm:text-sm">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="yellow">{user.role === "admin" ? "Administrator" : "Member KopiAman"}</Badge>
                  <Badge tone="green">● {user.status === "active" ? "Aktif" : user.status}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickPhoto}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                Ubah Foto
              </Button>
              {form.avatar_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setForm((f) => ({ ...f, avatar_url: "" }));
                    setMsg({ tone: "blue", text: "Foto dihapus. Klik 'Simpan Perubahan' untuk menyimpan." });
                  }}
                >
                  Hapus Foto
                </Button>
              )}
            </div>
          </div>

          {user.bio && <p className="mt-3 text-sm text-stone-600">{user.bio}</p>}
          {user.created_at && (
            <p className="mt-2 text-xs text-stone-400">Bergabung sejak {fmtDate(user.created_at)}</p>
          )}
        </div>
      </Card>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* Personal Info Form */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-stone-900">Informasi Profil &amp; Pengiriman</h2>
        <p className="mt-0.5 text-xs text-stone-500">Perbarui nama, foto profil, preferensi kopi, nomor HP, dan alamat pengiriman.</p>
        <form onSubmit={save} className="mt-4 space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="Email" value={user.email} disabled />
            <Input
              label="Nama lengkap"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              label="No. HP / WhatsApp"
              maxLength={30}
              placeholder="08xxxxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Bio / Preferensi Kopi"
              maxLength={300}
              placeholder="Mis. Suka V60 Aceh Gayo & Es Kopi Susu"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <Textarea
            label="Alamat pengiriman"
            rows={3}
            maxLength={500}
            placeholder="Jl. ..., Kecamatan, Kota, Kode Pos"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Change Password Card */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-stone-900">Keamanan &amp; Password</h2>
        <p className="mt-0.5 text-xs text-stone-500">Gunakan password kuat minimal 8 karakter (huruf besar, huruf kecil, dan angka).</p>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <Input
            label="Password lama"
            type="password"
            required
            autoComplete="current-password"
            value={pw.old_password}
            onChange={(e) => setPw({ ...pw, old_password: e.target.value })}
          />
          <Input
            label="Password baru"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" variant="secondary" disabled={busy}>
              Ganti Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Unified Logout Section at the Bottom */}
      <Card className="border-red-200/80 bg-red-50/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Keluar dari Akun</h2>
            <p className="text-xs text-stone-600">Akhiri sesi login Anda di perangkat ini dengan aman.</p>
          </div>
          <Button type="button" variant="danger" onClick={handleLogout} className="w-full sm:w-auto">
            Keluar
          </Button>
        </div>
      </Card>
    </div>
  );
}
