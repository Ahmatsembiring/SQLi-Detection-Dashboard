import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!user || user.role !== "user") return setItems([]);
    try {
      setItems(await api("/api/cart"));
    } catch {
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (productId, quantity = 1) =>
    setItems(await api("/api/cart", { method: "POST", body: { product_id: productId, quantity } }));
  const update = async (itemId, quantity) =>
    setItems(await api(`/api/cart/${itemId}`, { method: "PATCH", body: { quantity } }));
  const remove = async (itemId) => setItems(await api(`/api/cart/${itemId}`, { method: "DELETE" }));

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, total, add, update, remove, refresh }}>{children}</CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
