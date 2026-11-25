"""Idempotent demo data: admin account, demo users, categories, products, reviews.

Runs without a request context, so its statements are NOT tagged and the log
collector ignores them (only tagged application traffic is analyzed).
"""
from __future__ import annotations

import os
import random
from decimal import Decimal

from sqlalchemy import select

from .db import SessionLocal
from .models import Category, Product, Review, User
from .security import hash_password

CATALOG = {
    "Single Origin Arabika": [
        ("Aceh Gayo Honey Process 250g", 95000,
         "Single origin dataran tinggi Gayo (1.500 mdpl). Medium roast dengan notes brown sugar, red apple, dan body lembut. Cocok untuk V60 & pour over."),
        ("Toraja Sapan Washed 250g", 98000,
         "Arabika Sulawesi Selatan proses full washed. Tasting notes dark chocolate, herbal manis, dan aftertaste bersih."),
        ("Flores Bajawa Natural 250g", 92000,
         "Diproses secara natural di lereng Gunung Inerie. Aroma berry manis, caramel, dengan tingkat keasaman seimbang."),
        ("Bali Kintamani Citrus 250g", 89000,
         "Arabika Kintamani light-medium roast dengan karakter segar jeruk nipis, madu bunga, dan finish yang crisp."),
        ("Java Ijen Blue 250g", 94000,
         "Kopi spesialti Jawa Timur dengan profil medium roast. Notes hazelnut, cacao nibs, dan sedikit spicy."),
        ("Mandheling Sumatera Semi-Washed 250g", 90000,
         "Karakter klasik Sumatera dengan body tebal, earthy, dark cocoa, dan keasaman rendah."),
    ],
    "Robusta Nusantara": [
        ("Robusta Fine Lampung 250g", 58000,
         "Petik merah dari Tanggamus, Lampung. Medium-dark roast dengan rasa cokelat pekat, kacang panggang, dan krema tebal."),
        ("Robusta Temanggung Dark Roast 250g", 55000,
         "Robusta lereng Gunung Sindoro dengan karakter bold, smoky, dan sedikit aroma tembakau manis."),
        ("Robusta Sidikalang Bold 250g", 62000,
         "Kopi legendaris Sumatera Utara, cocok untuk kopi tubruk maupun base es kopi susu kekinian."),
        ("Robusta Dampit Malang 250g", 56000,
         "Aroma nutty dan karamel pahit yang seimbang, dipanggang segar setiap minggu."),
    ],
    "House Blend & Espresso": [
        ("Espresso Blend Crema Forte 500g", 135000,
         "Racikan 70% Arabika Gayo & 30% Robusta Lampung. Menghasilkan krema keemasan tebal dengan notes dark chocolate."),
        ("Kopi Susu Blend Caramel Nutty 500g", 125000,
         "Diracik khusus agar rasa kopi tetap menonjol saat dipadukan dengan susu segar dan gula aren."),
        ("Morning Roast Balanced 250g", 78000,
         "House blend harian 100% Arabika Nusantara. Seimbang antara manis karamel dan keasaman ringan."),
        ("Decaf Swiss Water Process 250g", 115000,
         "Kopi bebas kafein 99,9% dengan metode Swiss Water tanpa bahan kimia. Aman dinikmati malam hari."),
    ],
    "Ready-to-Drink & Cold Brew": [
        ("Cold Brew Black Single Origin 250ml", 32000,
         "Diseduh dingin selama 16 jam menggunakan biji Arabika Flores. Halus, manis alami, dan rendah asam."),
        ("Es Kopi Susu Gula Aren 1 Liter", 75000,
         "Menu favorit KopiAman! Espresso house blend, susu segar, dan gula aren organik Lampung dalam botol 1L."),
        ("Japanese Iced Coffee Bottle 250ml", 34000,
         "Filter coffee Bali Kintamani seduh dingin cepat, menyegarkan dengan aroma citrus yang kuat."),
        ("Oat Milk Latte Botol 500ml", 52000,
         "Perpaduan double shot espresso dengan susu oat creamy, 100% plant-based dan tanpa pemanis buatan."),
    ],
    "Alat Seduh (Brewing Gear)": [
        ("V60 Ceramic Dripper Size 02", 145000,
         "Dripper keramik berkualitas tinggi yang menjaga stabilitas suhu seduhan untuk 1–4 cangkir kopi."),
        ("Gooseneck Kettle Stainless 600ml", 249000,
         "Teko leher angsa presisi untuk kontrol aliran air pour over yang stabil. Kompatibel dengan kompor gas & listrik."),
        ("Manual Coffee Grinder Conical Burr", 325000,
         "Penggiling kopi manual dengan mata pisau stainless steel conical burr dan 24 tingkat kehalusan gilingan."),
        ("Timbangan Kopi Digital + Timer", 185000,
         "Akurasi hingga 0,1 gram dilengkapi built-in timer dan mat silikon tahan panas untuk resep seduh presisi."),
        ("French Press Kaca Borosilikat 600ml", 139000,
         "Plunger stainless mesh ganda untuk menghasilkan kopi ber-body penuh dengan praktis."),
        ("Paper Filter V60 02 (100 Lembar)", 48000,
         "Kertas saring tipis bebas bau kertas untuk ekstraksi pour over yang jernih dan bersih."),
    ],
    "Pastry & Pendamping": [
        ("Artisan Butter Croissant (Isi 2)", 46000,
         "Dipanggang segar setiap pagi menggunakan mentega Prancis, renyah di luar dan lembut berlapis di dalam."),
        ("Cinnamon Roll Cream Cheese Glaze", 38000,
         "Roti gulung kayu manis hangat dengan glaze keju krim lembut. Teman sempurna untuk Americano panas."),
        ("Espresso Fudge Brownies (Box 4 pcs)", 54000,
         "Brownies cokelat pekat dengan infusi espresso house blend untuk rasa manis-pahit yang pas."),
        ("Banana Bread Walnut Slice", 32000,
         "Kue pisang panggang lembut bertabur kacang walnut renyah, tanpa pengawet."),
    ],
}
CATEGORY_DESCRIPTIONS = {
    "Single Origin Arabika": "Biji kopi Arabika pilihan dari berbagai daerah penghasil terbaik di Indonesia.",
    "Robusta Nusantara": "Fine Robusta petik merah dengan karakter kuat, body tebal, dan krema melimpah.",
    "House Blend & Espresso": "Racikan roaster KopiAman untuk espresso, kopi susu, dan seduhan harian.",
    "Ready-to-Drink & Cold Brew": "Kopi siap minum seduh segar, dikemas higienis dalam botol tertutup rapat.",
    "Alat Seduh (Brewing Gear)": "Peralatan manual brew dan aksesoris barista untuk menyeduh kopi di rumah.",
    "Pastry & Pendamping": "Kudapan panggang segar yang dipadukan khusus untuk menemani secangkir kopi.",
}
DEMO_USERS = [("Budi Santoso", "budi@example.com"), ("Siti Rahmawati", "siti@example.com"),
              ("Rizky Pratama", "rizky@example.com"), ("Dewi Lestari", "dewi@example.com"),
              ("Mallory Attacker", "mallory@example.com")]
DEMO_PASSWORD = "Password123!"
REVIEWS = [
    "Aroma kopinya wangi banget waktu kemasan dibuka, roast date-nya juga masih sangat segar!",
    "Notes cokelat dan karamelnya kerasa pas diseduh pakai V60. Pasti repeat order.",
    "Pengiriman cepat dari roastery, packing pakai valve bag dan bubble wrap rapi.",
    "Cocok banget buat base es kopi susu di rumah, rasanya balance tidak terlalu asam.",
    "Kualitas biji konsisten dan minim defect. Recommended roastery!",
]


def run() -> None:
    rnd = random.Random(7)
    with SessionLocal() as db:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@kopiaman.id").lower()
        if not db.scalar(select(User).where(User.email == admin_email)):
            db.add(User(name="Administrator", email=admin_email, role="admin",
                        password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "Admin12345!"))))
        users = []
        for name, email in DEMO_USERS:
            u = db.scalar(select(User).where(User.email == email))
            if u is None:
                u = User(name=name, email=email, role="user", password_hash=hash_password(DEMO_PASSWORD),
                         address="Jl. Terusan Ryacudu, Way Huwi, Lampung Selatan 35365", phone="081234567890")
                db.add(u)
            users.append(u)
        db.flush()

        if db.scalar(select(Product.id).limit(1)) is None:
            for cat_name, items in CATALOG.items():
                cat = Category(name=cat_name, description=CATEGORY_DESCRIPTIONS.get(cat_name, f"Kategori {cat_name}"))
                db.add(cat)
                db.flush()
                for pname, price, desc in items:
                    p = Product(name=pname, price=Decimal(price), stock=rnd.randint(8, 95), category_id=cat.id,
                                description=desc)
                    db.add(p)
                    db.flush()
                    for u in rnd.sample(users[:4], rnd.randint(1, 3)):
                        db.add(Review(product_id=p.id, user_id=u.id, rating=rnd.randint(4, 5),
                                      comment=rnd.choice(REVIEWS)))
        db.commit()
    print("seed: done")


if __name__ == "__main__":
    run()
