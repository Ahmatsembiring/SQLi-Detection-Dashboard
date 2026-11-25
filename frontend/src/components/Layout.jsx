import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useCart } from "../cart";

const navCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-amber-100/80 text-amber-900" : "text-stone-600 hover:bg-stone-100"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#fffdf9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold text-stone-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4a2c1a] text-sm font-bold text-amber-100">K</span>
            <span className="flex flex-col leading-tight">
              <span>KopiAman</span>
              <span className="text-[10px] font-medium tracking-wider text-amber-800 uppercase">Roastery &amp; Coffee Shop</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={navCls}>Menu Kopi</NavLink>
            {user?.role === "user" && (
              <>
                <NavLink to="/cart" className={navCls}>
                  Keranjang{count > 0 && <span className="ml-1 rounded-full bg-amber-800 px-1.5 text-xs text-amber-50 tabular">{count}</span>}
                </NavLink>
                <NavLink to="/orders" className={navCls}>Pesanan</NavLink>
              </>
            )}
            {user?.role === "admin" && <NavLink to="/admin" className={navCls}>Dashboard Keamanan</NavLink>}
            {user ? (
              <>
                <NavLink to="/profile" className={navCls}>{user.name.split(" ")[0]}</NavLink>
                <button
                  className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
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
                <NavLink to="/register" className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900">
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
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        KopiAman Roastery · OWASP-Hardened Coffee Shop — aktivitas database dipantau real-time untuk deteksi SQL Injection
      </footer>
    </div>
  );
}
