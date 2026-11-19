import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import Home from './pages/Home.jsx';
import Assistant from './pages/Assistant.jsx';
import Discover from './pages/Discover.jsx';
import Recommendations from './pages/Recommendations.jsx';
import SystemCheck from './pages/SystemCheck.jsx';
import Login from './pages/Login.jsx';
import Library from './pages/Library.jsx';
import PlaylistDetail from './pages/PlaylistDetail.jsx';
import Profile from './pages/Profile.jsx';
import Credits from './pages/Credits.jsx';
import NotFound from './pages/NotFound.jsx';

// The list of pages. Every page is drawn inside AppShell (header + footer).
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="discover" element={<Discover />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="library" element={<Library />} />
        <Route path="library/playlists/:id" element={<PlaylistDetail />} />
        <Route path="profile" element={<Profile />} />
        <Route path="login" element={<Login mode="login" />} />
        <Route path="register" element={<Login mode="register" />} />
        <Route path="credits" element={<Credits />} />
        <Route path="status" element={<SystemCheck />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
