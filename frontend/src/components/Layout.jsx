import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useCart } from "../cart";

const navCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-amber-100/80 text-amber-900" : "text-stone-600 hover:bg-stone-100"}`;

const mobileNavCls = ({ isActive }) =>
  `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-amber-100/80 text-amber-900" : "text-stone-700 hover:bg-stone-100"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#fffdf9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" onClick={close} className="flex items-center gap-2.5 text-lg font-bold text-stone-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4a2c1a] text-sm font-bold text-amber-100">K</span>
            <span className="flex flex-col leading-tight">
              <span>KopiAman</span>
              <span className="text-[10px] font-medium tracking-wider text-amber-800 uppercase">Roastery &amp; Coffee Shop</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
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

          {/* Mobile Quick Actions + Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {user?.role === "user" && (
              <Link to="/cart" onClick={close} className="relative rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700">
                Keranjang{count > 0 && <span className="ml-1 rounded-full bg-amber-800 px-1.5 text-[11px] text-amber-50 tabular">{count}</span>}
              </Link>
            )}
            {!user && (
              <Link to="/login" onClick={close} className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-amber-50">
                Masuk
              </Link>
            )}
            <button
              type="button"
              aria-label="Toggle menu navigasi"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <nav className="border-t border-stone-200 bg-[#fffdf9] px-4 py-3 md:hidden">
            <div className="space-y-1">
              <NavLink to="/" end onClick={close} className={mobileNavCls}>Menu Kopi</NavLink>
              {user?.role === "user" && (
                <>
                  <NavLink to="/cart" onClick={close} className={mobileNavCls}>
                    Keranjang {count > 0 ? `(${count})` : ""}
                  </NavLink>
                  <NavLink to="/orders" onClick={close} className={mobileNavCls}>Pesanan Saya</NavLink>
                </>
              )}
              {user?.role === "admin" && (
                <NavLink to="/admin" onClick={close} className={mobileNavCls}>Dashboard Keamanan</NavLink>
              )}
              {user ? (
                <>
                  <NavLink to="/profile" onClick={close} className={mobileNavCls}>Profil ({user.name.split(" ")[0]})</NavLink>
                  <button
                    className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      close();
                      await logout();
                      navigate("/");
                    }}
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" onClick={close} className={mobileNavCls}>Masuk</NavLink>
                  <NavLink to="/register" onClick={close} className="mt-1 block rounded-lg bg-amber-800 px-3 py-2.5 text-center text-sm font-medium text-amber-50 hover:bg-amber-900">
                    Daftar Akun Baru
                  </NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-6">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 px-4 py-5 text-center text-xs text-stone-500">
        KopiAman Roastery · OWASP-Hardened Coffee Shop — aktivitas database dipantau real-time untuk deteksi SQL Injection
      </footer>
    </div>
  );
}
