"""Generate synthetic *normal* e-commerce inputs (search, review, address, name, email, login).

Public SQLi datasets contain little text that looks like what users type into an
Indonesian online shop, so we generate it from templates. Hard negatives
(apostrophes, SQL keywords used in normal sentences, '--', '#') are included on
purpose so the model cannot simply learn "quote = attack" and FPR is measured honestly.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import pandas as pd

PRODUCTS = [
    "kaos polos", "kemeja flanel", "celana jeans", "jaket bomber", "hoodie oversize", "sepatu sneakers",
    "sandal jepit", "tas ransel", "dompet kulit", "jam tangan", "kacamata hitam", "topi baseball",
    "hijab segi empat", "gamis syari", "batik tulis", "kebaya modern", "sarung tenun", "mukena",
    "laptop gaming", "mouse wireless", "keyboard mechanical", "headset bluetooth", "powerbank 10000mah",
    "charger fast charging", "kabel type c", "smartwatch", "tws earbuds", "flashdisk 64gb", "ssd 512gb",
    "monitor 24 inch", "webcam hd", "speaker portable", "rice cooker", "blender", "setrika uap",
    "kipas angin", "dispenser", "panci set", "wajan anti lengket", "botol minum", "tumbler stainless",
    "skincare serum", "sunscreen spf 50", "facial wash", "lipstik matte", "parfum", "shampoo",
    "kopi arabika gayo", "kopi robusta lampung", "keripik pisang", "sambal roa", "madu hutan",
    "beras organik", "minyak goreng", "mainan edukasi", "lego", "buku novel", "alat tulis",
    "raket badminton", "bola futsal", "matras yoga", "dumbbell", "sepeda lipat", "helm", "jas hujan",
    "case iphone", "tempered glass", "tripod", "ring light", "printer", "tinta printer", "router wifi",
]
MODIFIERS = ["murah", "original", "ori", "promo", "diskon", "terbaru", "premium", "bekas", "second",
             "import", "lokal", "grosir", "cod", "free ongkir", "size xl", "size l", "ukuran 42",
             "warna hitam", "warna putih", "navy", "pria", "wanita", "anak", "2024", "2025", "best seller"]
BRANDS = ["samsung", "xiaomi", "asus", "lenovo", "logitech", "eiger", "uniqlo", "erigo", "wardah",
          "somethinc", "miniso", "philips", "cosmos", "miyako", "nike", "adidas", "levi's", "dr. martens",
          "l'oreal", "ventela", "compass", "aerostreet", "h&m", "marks & spencer", "ben & jerry's"]
FIRST = ["Ahmad", "Budi", "Siti", "Dewi", "Rizky", "Putri", "Agus", "Rina", "Fajar", "Nur", "Ma'ruf",
         "Jum'at", "Sa'diyah", "Ni'mah", "Mu'min", "Indah", "Yoga", "Andi", "Wahyu", "Lestari", "Kevin",
         "Michael", "Sarah", "Dian", "Bayu", "Taufik", "Aisyah", "Fitri", "Rahmat", "Desi", "O'Brien",
         "D'Angelo", "Hendra", "Galih", "Ratna", "Yusuf", "Zahra", "Ilham", "Nabila", "Sinta"]
LAST = ["Saputra", "Wijaya", "Pratama", "Sembiring", "Ginting", "Siregar", "Nasution", "Hidayat",
        "Kurniawan", "Santoso", "Lubis", "Harahap", "Setiawan", "Rahmawati", "Purba", "Tarigan",
        "Simanjuntak", "O'Neil", "Halim", "Gunawan", "Susanto", "Wibowo", "Ma'arif", "Hasibuan"]
STREETS = ["Jl. Sudirman", "Jl. Ahmad Yani", "Jl. Pagar Alam", "Jl. Teuku Umar", "Jl. Diponegoro",
           "Jl. Gatot Subroto", "Jl. Raden Intan", "Jl. Kartini", "Jl. Pramuka", "Jl. Terusan Ryacudu",
           "Jl. Z.A. Pagar Alam", "Gg. Mawar", "Jl. Way Huwi", "Jl. Imam Bonjol", "Jl. Hayam Wuruk"]
ALLEYS = ["Melati", "Kenanga", "H. Ma'ruf", "Haji Jum'at", "Swadaya"]
CITIES = [("Bandar Lampung", "35145"), ("Lampung Selatan", "35365"), ("Metro", "34111"),
          ("Jakarta Selatan", "12190"), ("Bandung", "40132"), ("Surabaya", "60271"), ("Medan", "20112"),
          ("Yogyakarta", "55281"), ("Palembang", "30128"), ("Semarang", "50241"), ("Makassar", "90111")]
DOMAINS = ["gmail.com", "yahoo.co.id", "student.itera.ac.id", "outlook.com", "mail.com", "ymail.com"]

REVIEW_OPENERS = ["Barangnya bagus", "Mantap", "Sesuai deskripsi", "Kualitas oke", "Pengiriman cepat",
                  "Agak kecewa", "Lumayan", "Recommended seller", "Packing rapi", "Original 100%",
                  "Great product", "Not bad", "Love it!", "Kurang sesuai ekspektasi", "Top banget"]
REVIEW_BODIES = [
    "ukurannya pas di badan", "warnanya sedikit beda dari foto", "seller ramah dan fast respon",
    "baru sampai langsung dicoba, aman", "dus agak penyok tapi isinya aman", "bahannya adem",
    "bisa untuk sehari-hari", "harga segini dapat kualitas begini worth it", "kurir agak telat 2 hari",
    "sudah order ke-3 kalinya di toko ini", "awalnya ragu, ternyata bagus", "jahitan rapi",
    "baterainya awet seharian", "suaranya jernih, bass mantap", "aromanya wangi tahan lama",
    "pilih (select) varian merah tapi yang datang merah juga, sesuai", "order kedua tetap puas",
    "union dari 2 paket digabung jadi satu kiriman, hemat ongkir", "drop ship lancar",
    "nilai 5/5 -- pasti beli lagi", "rating 10/10 #puas", "gak ada yang kurang, or maybe sedikit mahal",
    "kalau dibandingkan toko sebelah, ini lebih baik and lebih murah", "it's okay, doesn't fit me though",
    "I'd buy again", "can't complain", "dikirim pakai JNE, 1-2 hari sampai", "anak saya suka",
    "update: setelah 1 bulan masih awet", "cocok untuk hadiah ultah", "ga nyesel beli disini",
]
REVIEW_CLOSERS = ["", "", "Terima kasih!", "Sukses terus kak", ":)", "\U0001F44D", "Bintang 5!", "Mantul",
                  "Next order lagi", "Recommended!!", "Thx seller", "Semoga awet", "^_^"]
QUESTIONS = ["apakah ready stok?", "ada warna lain kak?", "bisa kirim hari ini?", "ukuran L lingkar dadanya berapa?",
             "garansi berapa lama?", "bisa COD?", "minimal order berapa?", "ini ori atau kw?",
             "where is my order?", "kapan restock?", "bisa nego?", "berat paketnya berapa kg?"]


def rnd_name(r: random.Random) -> str:
    return f"{r.choice(FIRST)} {r.choice(LAST)}"


def rnd_search(r: random.Random) -> str:
    parts = [r.choice(PRODUCTS)]
    if r.random() < 0.4:
        parts.insert(0, r.choice(BRANDS))
    if r.random() < 0.5:
        parts.append(r.choice(MODIFIERS))
    text = " ".join(parts)
    if r.random() < 0.1:  # typos
        i = r.randrange(len(text))
        text = text[:i] + text[i + 1:]
    if r.random() < 0.15:
        text = text.title()
    return text


def rnd_review(r: random.Random) -> str:
    parts = [r.choice(REVIEW_OPENERS)]
    for _ in range(r.randint(0, 2)):
        parts.append(r.choice(REVIEW_BODIES))
    closer = r.choice(REVIEW_CLOSERS)
    text = r.choice([", ", ". ", " ", "! "]).join(parts)
    return f"{text}. {closer}".strip() if closer else text


def rnd_address(r: random.Random) -> str:
    city, zipc = r.choice(CITIES)
    no = r.randint(1, 250)
    rt, rw = r.randint(1, 15), r.randint(1, 10)
    return r.choice([
        f"{r.choice(STREETS)} No. {no}, RT {rt:02d}/RW {rw:02d}, {city} {zipc}",
        f"{r.choice(STREETS)} no {no} {city}",
        f"Perum Griya Asri Blok {r.choice('ABCDE')}{r.randint(1, 20)} #{r.randint(1, 9)}, {city}",
        f"{r.choice(STREETS)} Gg. {r.choice(ALLEYS)} No.{no}, {city}, {zipc}",
        f"Kost Putri Bu {r.choice(LAST)}, kamar {r.randint(1, 30)}, dekat kampus ITERA, {city}",
    ])


def rnd_email(r: random.Random) -> str:
    first = r.choice(FIRST).lower().replace("'", "")
    last = r.choice(LAST).lower().replace("'", "")
    user = r.choice([f"{first}.{last}", f"{first}{r.randint(1, 999)}", f"{first}_{last}{r.randint(90, 99)}",
                     f"{first[0]}{last}", f"{r.randint(120000000, 129999999)}"])
    return f"{user}@{r.choice(DOMAINS)}"


def rnd_username(r: random.Random) -> str:
    first = r.choice(FIRST).lower().replace("'", "")
    return r.choice([first, f"{first}{r.randint(1, 9999)}", f"{first}_{r.choice(LAST).lower()}",
                     f"xX{first}Xx", f"{first}.id"])


def rnd_misc(r: random.Random) -> str:
    return r.choice([
        f"08{r.randint(1000000000, 9999999999)}",
        f"+62 8{r.randint(100, 999)}-{r.randint(1000, 9999)}-{r.randint(1000, 9999)}",
        r.choice(QUESTIONS),
        f"Catatan: tolong {r.choice(['bubble wrap', 'packing kayu', 'jangan dibanting'])} ya",
        f"INV/2025/{r.randint(1, 12):02d}/{r.randint(10000, 99999)}",
        f"{r.randint(1, 5)} pcs",
        f"Promo {r.choice(['11.11', '12.12', 'Harbolnas', 'Ramadhan'])} 50% off!",
    ])


GENERATORS = {
    "search": (rnd_search, 0.30), "review": (rnd_review, 0.25), "address": (rnd_address, 0.12),
    "name": (rnd_name, 0.08), "email": (rnd_email, 0.10), "username": (rnd_username, 0.07), "misc": (rnd_misc, 0.08),
}


def generate(n: int, seed: int) -> pd.DataFrame:
    r = random.Random(seed)
    kinds, weights = zip(*[(k, w) for k, (_, w) in GENERATORS.items()])
    rows = []
    for _ in range(n):
        kind = r.choices(kinds, weights)[0]
        rows.append({"payload": GENERATORS[kind][0](r), "source": f"synthetic_{kind}"})
    return pd.DataFrame(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "data/raw/ecommerce_normal.csv"))
    args = ap.parse_args()
    df = generate(args.n, args.seed)
    df.to_csv(args.out, index=False)
    print(f"wrote {len(df)} rows ({df.payload.nunique()} unique) -> {args.out}")


if __name__ == "__main__":
    main()
