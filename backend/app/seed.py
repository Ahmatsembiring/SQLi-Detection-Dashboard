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
    "Fashion Pria": [("Kemeja Flanel Kotak", 149000), ("Kaos Polos Cotton Combed 30s", 59000),
                     ("Celana Chino Slim Fit", 189000), ("Jaket Bomber Waterproof", 259000),
                     ("Hoodie Oversize Basic", 175000)],
    "Fashion Wanita": [("Gamis Syari Premium", 239000), ("Hijab Segi Empat Voal", 45000),
                       ("Blouse Rayon Motif", 99000), ("Rok Plisket Panjang", 89000),
                       ("Kebaya Modern Brokat", 329000)],
    "Elektronik": [("Headset Bluetooth TWS", 199000), ("Powerbank 10000mAh Fast Charging", 165000),
                   ("Mouse Wireless Silent Click", 79000), ("Keyboard Mechanical RGB", 449000),
                   ("Smartwatch Fitness Tracker", 389000), ("Speaker Portable Bass", 219000)],
    "Komputer & Aksesoris": [("SSD NVMe 512GB", 699000), ("Flashdisk 64GB USB 3.0", 89000),
                             ("Webcam Full HD 1080p", 259000), ("Monitor 24 Inch IPS", 1599000),
                             ("Router WiFi Dual Band", 349000)],
    "Rumah Tangga": [("Rice Cooker 1.8L", 329000), ("Blender Kaca 2 Liter", 279000),
                     ("Setrika Uap Portable", 189000), ("Panci Set Stainless 5 pcs", 399000),
                     ("Tumbler Stainless 500ml", 69000)],
    "Kecantikan": [("Serum Niacinamide 10%", 89000), ("Sunscreen SPF 50 PA++++", 75000),
                   ("Facial Wash Gentle", 45000), ("Lipstik Matte Tahan Lama", 59000),
                   ("Parfum Eau de Toilette 50ml", 149000)],
    "Makanan & Minuman": [("Kopi Robusta Lampung 250g", 55000), ("Kopi Arabika Gayo 250g", 85000),
                          ("Keripik Pisang Lampung", 25000), ("Madu Hutan Asli 500ml", 120000),
                          ("Sambal Roa Manado", 45000)],
    "Olahraga": [("Raket Badminton Carbon", 289000), ("Bola Futsal Size 4", 159000),
                 ("Matras Yoga 8mm", 129000), ("Dumbbell Set 10kg", 349000), ("Sepatu Lari Ringan", 459000)],
}
DESCRIPTIONS = [
    "Produk berkualitas dengan bahan pilihan. Cocok untuk penggunaan sehari-hari.",
    "Best seller! Garansi resmi dan pengiriman cepat dari Bandar Lampung.",
    "Original 100%, stok terbatas. Dikemas aman dengan bubble wrap.",
    "Desain modern dan tahan lama. Tersedia berbagai pilihan warna.",
]
DEMO_USERS = [("Budi Santoso", "budi@example.com"), ("Siti Rahmawati", "siti@example.com"),
              ("Rizky Pratama", "rizky@example.com"), ("Dewi Lestari", "dewi@example.com"),
              ("Mallory Attacker", "mallory@example.com")]
DEMO_PASSWORD = "Password123!"
REVIEWS = ["Barangnya bagus, sesuai deskripsi", "Pengiriman cepat, packing rapi. Mantap!",
           "Kualitas oke untuk harga segini", "Agak telat sampai tapi barang aman", "Recommended seller!"]


def run() -> None:
    rnd = random.Random(7)
    with SessionLocal() as db:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@tokoaman.id").lower()
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
                cat = Category(name=cat_name, description=f"Kategori {cat_name}")
                db.add(cat)
                db.flush()
                for pname, price in items:
                    p = Product(name=pname, price=Decimal(price), stock=rnd.randint(5, 120), category_id=cat.id,
                                description=rnd.choice(DESCRIPTIONS))
                    db.add(p)
                    db.flush()
                    for u in rnd.sample(users[:4], rnd.randint(0, 3)):
                        db.add(Review(product_id=p.id, user_id=u.id, rating=rnd.randint(3, 5),
                                      comment=rnd.choice(REVIEWS)))
        db.commit()
    print("seed: done")


if __name__ == "__main__":
    run()
