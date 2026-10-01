import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";

const links = [
  ["/admin", "Dashboard", true],
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
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">T</span>
            TokoAman <span className="text-xs font-normal text-slate-500">Admin</span>
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-4 py-4 text-xs text-slate-500 md:absolute md:bottom-0 md:block">
          Masuk sebagai <span className="font-medium text-slate-700">{user.name}</span>
          <button className="mt-1 block text-blue-600 hover:underline" onClick={async () => { await logout(); navigate("/"); }}>
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
