import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";

const links = [
  ["/admin", "Dashboard", true],
  ["/admin/owasp-lab", "Lab OWASP"],
  ["/admin/logs", "Log deteksi"],
  ["/admin/users", "Pengguna & risiko"],
  ["/admin/orders", "Pesanan"],
  ["/admin/products", "Produk"],
  ["/admin/categories", "Kategori"],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3.5 md:block md:py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-stone-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4a2c1a] text-amber-100">K</span>
            KopiAman <span className="text-xs font-normal text-stone-500">Admin</span>
          </Link>
          <button
            className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 md:hidden"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            Keluar
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-amber-100/80 text-amber-900" : "text-stone-600 hover:bg-stone-100"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-4 py-4 text-xs text-stone-500 md:absolute md:bottom-0 md:block">
          Masuk sebagai <span className="font-medium text-stone-700">{user.name}</span>
          <button className="mt-1 block text-amber-800 hover:underline" onClick={async () => { await logout(); navigate("/"); }}>
            Keluar
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
