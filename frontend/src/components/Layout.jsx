import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useCart } from "../cart";

const navCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">T</span>
            TokoAman
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={navCls}>Belanja</NavLink>
            {user?.role === "user" && (
              <>
                <NavLink to="/cart" className={navCls}>
                  Keranjang{count > 0 && <span className="ml-1 rounded-full bg-blue-600 px-1.5 text-xs text-white tabular">{count}</span>}
                </NavLink>
                <NavLink to="/orders" className={navCls}>Pesanan</NavLink>
              </>
            )}
            {user?.role === "admin" && <NavLink to="/admin" className={navCls}>Dashboard Admin</NavLink>}
            {user ? (
              <>
                <NavLink to="/profile" className={navCls}>{user.name.split(" ")[0]}</NavLink>
                <button
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navCls}>Masuk</NavLink>
                <NavLink to="/register" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Daftar
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        TokoAman · prototipe tugas akhir — aktivitas database dipantau untuk deteksi SQL Injection
      </footer>
    </div>
  );
}
