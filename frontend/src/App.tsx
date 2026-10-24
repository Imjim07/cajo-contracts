import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { WalletProvider } from './components/WalletProvider';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LandingPage } from './pages/landing/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="app" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </WalletProvider>
  );
}
