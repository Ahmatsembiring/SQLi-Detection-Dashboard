import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

let gisLoader = null;
function loadGisScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisLoader) {
    gisLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Gagal memuat Google Sign-In"));
      document.head.appendChild(s);
    });
  }
  return gisLoader;
}

export default function GoogleAuthButton({ mode = "signup", onSuccess, onError }) {
  const { loginWithGoogle } = useAuth();
  const btnRef = useRef(null);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    let active = true;
    api("/api/auth/providers")
      .then((p) => {
        if (active) setProvider(p);
      })
      .catch(() => {
        if (active) setProvider({ google_enabled: false });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!provider?.google_enabled || !provider.google_client_id || !btnRef.current) return;
    let cancelled = false;

    loadGisScript()
      .then(() => {
        if (cancelled || !btnRef.current || !window.google?.accounts?.id) return;
        btnRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: provider.google_client_id,
          callback: async (response) => {
            try {
              const user = await loginWithGoogle(response.credential);
              onSuccess?.(user);
            } catch (err) {
              onError?.(err.message || "Gagal masuk dengan Google");
            }
          },
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          locale: "id",
        });
      })
      .catch((err) => onError?.(err.message));

    return () => {
      cancelled = true;
    };
  }, [provider, mode, loginWithGoogle, onSuccess, onError]);

  if (provider === null) return null;

  return (
    <div className="space-y-2">
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-stone-200" />
        <span className="mx-3 shrink-0 text-xs text-stone-400">atau</span>
        <div className="flex-grow border-t border-stone-200" />
      </div>

      {provider.google_enabled ? (
        <div ref={btnRef} className="flex justify-center" />
      ) : (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10.1 0 12s.4 3.8 1.2 5.4l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4 3.1c1-2.9 3.6-4.9 6.8-4.9z" />
            </svg>
            {mode === "signup" ? "Daftar dengan Gmail (Google)" : "Masuk dengan Gmail (Google)"}
          </button>
          <p className="text-center text-[11px] text-stone-400">
            Isi <code className="rounded bg-stone-100 px-1">GOOGLE_CLIENT_ID</code> di <code className="rounded bg-stone-100 px-1">.env</code> untuk mengaktifkan.
          </p>
        </div>
      )}
    </div>
  );
}
