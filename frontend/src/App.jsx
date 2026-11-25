import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminCategories from "./pages/admin/Categories";
import Dashboard from "./pages/admin/Dashboard";
import AdminLogs from "./pages/admin/Logs";
import AdminOrders from "./pages/admin/Orders";
import OwaspLab from "./pages/admin/OwaspLab";
import AdminProducts from "./pages/admin/Products";
import AdminUsers from "./pages/admin/Users";
import Cart from "./pages/Cart";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import Register from "./pages/Register";

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="cart" element={<RequireAuth role="user"><Cart /></RequireAuth>} />
        <Route path="orders" element={<RequireAuth role="user"><Orders /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
      </Route>
      <Route path="admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="owasp-lab" element={<OwaspLab />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="orders" element={<AdminOrders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
