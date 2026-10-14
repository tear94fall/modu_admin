import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import Layout from './components/Layout'
import AppSettingsPage from './pages/AppSettingsPage'
import LoginPage from './pages/LoginPage'
import MemberDetailPage from './pages/MemberDetailPage'
import MembersPage from './pages/MembersPage'
import MePage from './pages/MePage'
import ProductFormPage from './pages/ProductFormPage'
import CategoriesPage from './pages/CategoriesPage'
import CouponFormPage from './pages/CouponFormPage'
import CouponsPage from './pages/CouponsPage'
import { CustomerDetailRedirect, CustomersRedirect } from './pages/CustomerRedirect'
import OrderDetailPage from './pages/OrderDetailPage'
import OrdersPage from './pages/OrdersPage'
import PointAccountPage from './pages/PointAccountPage'
import PointsPage from './pages/PointsPage'
import ProductsPage from './pages/ProductsPage'
import PromotionFormPage from './pages/PromotionFormPage'
import PromotionsPage from './pages/PromotionsPage'
import PushCampaignDetailPage from './pages/PushCampaignDetailPage'
import PushCampaignFormPage from './pages/PushCampaignFormPage'
import PushCampaignsPage from './pages/PushCampaignsPage'
import PushPage from './pages/PushPage'
import ReviewDetailPage from './pages/ReviewDetailPage'
import ReviewsPage from './pages/ReviewsPage'
import RoomDetailPage from './pages/RoomDetailPage'
import RoomsPage from './pages/RoomsPage'
import TiersPage from './pages/TiersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth role="ROLE_ADMIN">
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/members" replace />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductFormPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          {/* 커머스 > 고객은 회원 화면으로 합쳤다. 옛 주소는 회원 목록(커머스)·회원 상세(커머스 탭)로 보낸다. */}
          <Route path="/customers" element={<CustomersRedirect />} />
          <Route path="/customers/:userId" element={<CustomerDetailRedirect />} />
          <Route path="/tiers" element={<TiersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/reviews/:id" element={<ReviewDetailPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/promotions/new" element={<PromotionFormPage />} />
          <Route path="/promotions/:id" element={<PromotionFormPage />} />
          <Route path="/push" element={<PushPage />} />
          <Route path="/push-campaigns" element={<PushCampaignsPage />} />
          <Route path="/push-campaigns/new" element={<PushCampaignFormPage />} />
          <Route path="/push-campaigns/:id" element={<PushCampaignDetailPage />} />
          <Route path="/points" element={<PointsPage />} />
          <Route path="/points/:userId" element={<PointAccountPage />} />
          <Route path="/coupons" element={<CouponsPage />} />
          <Route path="/coupons/new" element={<CouponFormPage />} />
          <Route path="/coupons/:id" element={<CouponFormPage />} />
          <Route path="/settings" element={<AppSettingsPage />} />
          <Route path="/me" element={<MePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
