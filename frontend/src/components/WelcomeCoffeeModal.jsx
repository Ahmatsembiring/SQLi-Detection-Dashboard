import { useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "kopiaman_welcome_seen";

export default function WelcomeCoffeeModal() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  });
  const [closing, setClosing] = useState(false);

  // Only greet on the storefront homepage, never block auth or admin routes.
  if (!visible || pathname !== "/") return null;

  const enterSite = () => {
    if (closing) return;
    setClosing(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setTimeout(() => setVisible(false), 380);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selamat Datang di KopiAman"
      onClick={enterSite}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#140a05]/80 p-4 backdrop-blur-md transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/25 bg-[#1e120b] text-amber-50 shadow-[0_28px_70px_rgba(0,0,0,0.65)] transition-all duration-300 ${
          closing ? "scale-95 opacity-0" : "animate-fade-up scale-100 opacity-100"
        }`}
      >
        {/* Coffee Cup Image + Animated Rising Steam */}
        <div className="relative h-72 w-full overflow-hidden sm:h-80">
          <img
            src="/images/coffee/welcome-cup.jpg"
            alt="Secangkir kopi hangat KopiAman"
            className="animate-hero-zoom h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e120b] via-[#1e120b]/25 to-black/10" />

          {/* Animated Rising Steam Wisps centered above the coffee cup */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative -mt-16 h-36 w-36">
              <svg viewBox="0 0 120 140" className="steam-wisp absolute inset-0 h-full w-full" style={{ animationDelay: "0s" }}>
                <path
                  d="M52 130 C 38 98, 72 72, 50 40 C 38 22, 54 10, 60 2"
                  fill="none"
                  stroke="rgba(255,250,240,0.68)"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
              <svg viewBox="0 0 120 140" className="steam-wisp-alt absolute inset-0 h-full w-full" style={{ animationDelay: "1.1s" }}>
                <path
                  d="M68 132 C 84 102, 46 74, 68 42 C 78 24, 62 12, 56 4"
                  fill="none"
                  stroke="rgba(255,245,230,0.58)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
              <svg viewBox="0 0 120 140" className="steam-wisp absolute inset-0 h-full w-full" style={{ animationDelay: "2.2s" }}>
                <path
                  d="M60 135 C 48 106, 76 80, 58 48 C 48 30, 64 16, 66 6"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={enterSite}
            aria-label="Tutup"
            className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/35 text-xs text-amber-100 backdrop-blur-sm transition hover:bg-black/55"
          >
            ✕
          </button>
        </div>

        {/* Welcome Text & Enter CTA */}
        <div className="space-y-3 px-6 pt-2 pb-6 text-center">
          <span className="inline-block rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-0.5 text-[11px] font-medium tracking-wider text-amber-200 uppercase">
            KopiAman Roastery · Fresh Brew
          </span>
          <h2 className="font-display text-2xl font-bold tracking-tight text-amber-50">
            Selamat Datang di KopiAman
          </h2>
          <p className="text-xs leading-relaxed text-amber-100/80 sm:text-sm">
            Nikmati kehangatan biji kopi spesialti Nusantara dengan pengalaman belanja yang elegan dan terlindungi standar keamanan OWASP.
          </p>
          <button
            type="button"
            onClick={enterSite}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-[#22140c] shadow-lg transition duration-200 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98]"
          >
            Masuk ke Menu Kopi →
          </button>
        </div>
      </div>
    </div>
  );
}
