import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useCart } from "../cart";

const navCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-amber-200/20 text-amber-100" : "text-amber-100/75 hover:bg-white/10 hover:text-amber-50"
  }`;

const mobileNavCls = ({ isActive }) =>
  `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive ? "bg-amber-200/20 text-amber-100" : "text-amber-100/80 hover:bg-white/10 hover:text-amber-50"
  }`;

function UserAvatar({ user, size = "h-6 w-6 text-[11px]" }) {
  const initials = (user?.name || "K")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-700 font-bold text-amber-50 ${size}`}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </span>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);
  const isFullBleed = pathname === "/" || pathname === "/login" || pathname === "/register";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-amber-200/15 bg-[#22140c]/95 text-amber-50 shadow-[0_6px_24px_rgba(24,12,6,0.2)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" onClick={close} className="flex items-center gap-2.5 text-lg font-bold text-amber-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-gradient-to-br from-amber-700 to-amber-900 text-sm font-bold text-amber-50 shadow-inner">K</span>
            <span className="flex flex-col leading-tight">
              <span className="font-display tracking-wide">KopiAman</span>
              <span className="text-[10px] font-medium tracking-[0.18em] text-amber-300/90 uppercase">Roastery &amp; Coffee Shop</span>
            </span>
          </Link>

          {/* Desktop Navigation — Profile & Logout unified inside /profile */}
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navCls}>Menu Kopi</NavLink>
            {user?.role === "user" && (
              <>
                <NavLink to="/cart" className={navCls}>
                  Keranjang{count > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-[#22140c] tabular">{count}</span>}
                </NavLink>
                <NavLink to="/orders" className={navCls}>Pesanan</NavLink>
              </>
            )}
            {user?.role === "admin" && <NavLink to="/admin" className={navCls}>Dashboard Keamanan</NavLink>}
            {user ? (
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `ml-1 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium transition ${
                    isActive
                      ? "border-amber-300/60 bg-amber-200/20 text-amber-50"
                      : "border-amber-200/20 bg-white/5 text-amber-100 hover:bg-white/10"
                  }`
                }
              >
                <UserAvatar user={user} />
                <span>{user.name.split(" ")[0]}</span>
              </NavLink>
            ) : (
              <>
                <NavLink to="/login" className={navCls}>Masuk</NavLink>
                <NavLink to="/register" className="ml-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-2 text-sm font-semibold text-[#22140c] shadow-sm transition hover:from-amber-400 hover:to-amber-500">
                  Daftar
                </NavLink>
              </>
            )}
          </nav>

          {/* Mobile Quick Actions + Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {user?.role === "user" && (
              <Link to="/cart" onClick={close} className="relative rounded-lg border border-amber-200/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-amber-50">
                Keranjang{count > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-[#22140c] tabular">{count}</span>}
              </Link>
            )}
            {user ? (
              <Link to="/profile" onClick={close} aria-label="Profil" className="rounded-full border border-amber-300/40 p-0.5">
                <UserAvatar user={user} size="h-7 w-7 text-xs" />
              </Link>
            ) : (
              <Link to="/login" onClick={close} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-[#22140c]">
                Masuk
              </Link>
            )}
            <button
              type="button"
              aria-label="Toggle menu navigasi"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200/20 bg-white/10 text-amber-50 hover:bg-white/15"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <nav className="border-t border-amber-200/15 bg-[#29180f] px-4 py-3 md:hidden">
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
                <NavLink to="/profile" onClick={close} className={mobileNavCls}>
                  <span className="inline-flex items-center gap-2">
                    <UserAvatar user={user} size="h-5 w-5 text-[10px]" />
                    Profil &amp; Akun ({user.name.split(" ")[0]})
                  </span>
                </NavLink>
              ) : (
                <>
                  <NavLink to="/login" onClick={close} className={mobileNavCls}>Masuk</NavLink>
                  <NavLink to="/register" onClick={close} className="mt-1 block rounded-lg bg-amber-500 px-3 py-2.5 text-center text-sm font-semibold text-[#22140c] hover:bg-amber-400">
                    Daftar Akun Baru
                  </NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
      <main
        className={
          isFullBleed
            ? "flex w-full flex-1 flex-col"
            : "mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
        }
      >
        <Outlet />
      </main>
      <footer className="border-t border-amber-200/15 bg-[#1c1009] px-4 py-6 text-center text-xs text-amber-100/70">
        <span className="font-display font-semibold text-amber-200">KopiAman Roastery</span> · OWASP-Hardened Specialty Coffee Shop — aktivitas database dipantau real-time untuk deteksi SQL Injection
      </footer>
    </div>
  );
}
