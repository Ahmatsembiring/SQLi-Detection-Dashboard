/* Small set of UI primitives (Tailwind). shadcn/ui was skipped on purpose: a handful of
   components is enough here and avoids extra setup that does not serve the thesis. */

const cx = (...c) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", size = "md", className, ...props }) {
  const variants = {
    primary: "bg-amber-800 text-amber-50 hover:bg-amber-900 disabled:bg-amber-300",
    secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    ghost: "text-stone-700 hover:bg-stone-100",
  };
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition",
        "disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700",
        variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function Input({ label, className, id, ...props }) {
  const inputId = id || props.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>}
      <input
        id={inputId}
        className={cx("w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm",
          "focus:border-amber-700 focus:ring-2 focus:ring-amber-200 focus:outline-none", className)}
        {...props}
      />
    </label>
  );
}

export function Textarea({ label, className, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>}
      <textarea
        className={cx("w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm",
          "focus:border-amber-700 focus:ring-2 focus:ring-amber-200 focus:outline-none", className)}
        {...props}
      />
    </label>
  );
}

export function Select({ label, className, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>}
      <select
        className={cx("w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm",
          "focus:border-amber-700 focus:ring-2 focus:ring-amber-200 focus:outline-none", className)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Card({ className, ...props }) {
  return <div className={cx("rounded-xl border border-stone-200/90 bg-white shadow-sm", className)} {...props} />;
}

export function Badge({ tone = "slate", className, children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-amber-50 text-amber-800",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Status is never color-only: always icon + text. */
export function LabelBadge({ label, fp }) {
  if (fp) return <Badge tone="slate">✓ False positive</Badge>;
  return label === "SQLi" ? <Badge tone="red">⚠ SQLi</Badge> : <Badge tone="green">● Normal</Badge>;
}

export function SeverityBadge({ severity }) {
  const map = { High: ["red", "▲"], Medium: ["orange", "◆"], Low: ["yellow", "▼"] };
  const [tone, icon] = map[severity] || ["slate", "–"];
  return <Badge tone={tone}>{icon} {severity}</Badge>;
}

export function Alert({ tone = "red", children }) {
  const tones = { red: "border-red-200 bg-red-50 text-red-800", green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800" };
  return <div role="alert" className={cx("rounded-lg border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}

export function Spinner() {
  return <div className="py-10 text-center text-sm text-slate-500">Memuat…</div>;
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between py-3 text-sm text-slate-600">
      <span className="tabular">{total} data · halaman {page} dari {pages}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sebelumnya</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya →</Button>
      </div>
    </div>
  );
}

/** Deterministic coffee-palette placeholder image for products without a photo. */
export function ProductImage({ product, className }) {
  if (product.image_url) {
    return <img src={product.image_url} alt={product.name} className={cx("object-cover", className)} />;
  }
  const palettes = [
    ["#4a2c1a", "#78350f"], // espresso
    ["#7c2d12", "#b45309"], // roasted caramel
    ["#3f2305", "#6b4423"], // dark roast
    ["#5c4033", "#a16207"], // honey process
    ["#292524", "#57534e"], // brewing gear slate
    ["#713f12", "#ca8a04"], // golden pastry
  ];
  const [c1, c2] = palettes[(product.category_id || product.id || 0) % palettes.length];
  const initials = product.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className={cx("flex flex-col items-center justify-center gap-1 text-amber-50/95", className)}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      aria-hidden="true"
    >
      <span className="text-2xl font-bold tracking-wide">{initials}</span>
      <span className="text-[10px] font-medium uppercase tracking-widest text-amber-200/80">KopiAman</span>
    </div>
  );
}
