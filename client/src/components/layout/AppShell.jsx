import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import PlayerBar from '../player/PlayerBar.jsx';
import ServerBanner from './ServerBanner.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';

// The frame around every page: header on top, page in the middle, footer below.
// <Outlet /> is where React Router draws the current page.
export default function AppShell() {
  // Start every new page at the top.
  const { pathname } = useLocation();
  const { queue } = usePlayer();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    // Extra space at the bottom so the player never covers the page content.
    <div className={`flex min-h-screen flex-col ${queue.length ? 'pb-36 md:pb-32' : ''}`}>
      <a
        href="#main"
        className="btn-chrome sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to content
      </a>
      <Header />
      <ServerBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <PlayerBar />
    </div>
  );
}
