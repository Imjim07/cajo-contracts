import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="frame">
        <Navbar />
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
