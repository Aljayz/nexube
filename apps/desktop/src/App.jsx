import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { applyAccentColor } from './hooks/useSettings';
import CustomTitlebar from './components/CustomTitlebar';
import SplashScreen from './components/SplashScreen';
import SetupScreen from './components/SetupScreen';
import Navbar from './components/Navbar';
import SecurityOverlay from './components/SecurityOverlay';
import ProfileSelectScreen from './components/ProfileSelectScreen';
import HelpShortcutsModal from './components/HelpShortcutsModal';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import NoticeDialog from './components/NoticeDialog';
import UpdateNotification from './components/UpdateNotification';
import UpdateApiKeyModal from './components/UpdateApiKeyModal';

const HomeView = lazy(() => import('./pages/HomeView'));
const SearchView = lazy(() => import('./pages/SearchView'));
const LibraryView = lazy(() => import('./pages/LibraryView'));
const DetailView = lazy(() => import('./pages/DetailView'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));
const NotificationView = lazy(() => import('./pages/NotificationView'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [showProfileSelect, setShowProfileSelect] = useState(false);
  const [showAddProfileForm, setShowAddProfileForm] = useState(false);
  const [page, setPage] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nexube-page');
      return saved || 'home';
    } catch { return 'home'; }
  });
  const [selected, setSelected] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nexube-selected');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [navStack, setNavStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nexube-navstack');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeProfile, setActiveProfile] = useState(null);
  const [showSecurityOverlay, setShowSecurityOverlay] = useState(false);
  const [pinTarget, setPinTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [apiKeyInvalid, setApiKeyInvalid] = useState(null);
  const [showUpdateApiKey, setShowUpdateApiKey] = useState(false);

  const pageRef = useRef(page);
  const selectedRef = useRef(selected);
  const activeProfileRef = useRef(activeProfile);

  useEffect(() => { pageRef.current = page; try { sessionStorage.setItem('nexube-page', page); } catch {} }, [page]);
  useEffect(() => { selectedRef.current = selected; try { sessionStorage.setItem('nexube-selected', JSON.stringify(selected)); } catch {} }, [selected]);
  useEffect(() => { activeProfileRef.current = activeProfile; }, [activeProfile]);
  useEffect(() => {
    if (activeProfile?.accentColor) {
      applyAccentColor(activeProfile.accentColor);
    }
  }, [activeProfile]);
  useEffect(() => { try { sessionStorage.setItem('nexube-navstack', JSON.stringify(navStack)); } catch {} }, [navStack]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const apiKey = await window.electron?.storage?.get('tmdbApiKey');
        if (!apiKey) {
          setNeedsSetup(true);
          setLoading(false);
          return;
        }

        const activeProfileId = await window.electron?.profiles?.getActiveProfileId();
        if (activeProfileId) {
          const profiles = await window.electron?.profiles?.listProfiles();
          const profile = profiles?.find((p) => p.id === activeProfileId);
          if (profile) {
            if (profile.securityType && (profile.pinHash || profile.password)) {
              setRequiresAuth(true);
              setPinTarget({ type: 'login', profile });
              setShowSecurityOverlay(true);
            } else {
              setActiveProfile(profile);
            }
          }
        } else {
          setShowProfileSelect(true);
        }
      } catch {
        setNeedsSetup(true);
      }
      setLoading(false);

      const noticeDismissed = await window.electron?.storage?.get('noticeDismissed');
      if (!noticeDismissed) {
        setShowNotice(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const checkApiKeyHealth = useCallback(async () => {
    try {
      const apiKey = await window.electron?.storage?.get('tmdbApiKey');
      if (!apiKey) {
        setApiKeyInvalid(true);
        return;
      }
      await window.electron?.tmdb?.fetch('/authentication', {});
      setApiKeyInvalid(false);
    } catch {
      setApiKeyInvalid(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !needsSetup && !showProfileSelect && activeProfile) {
      checkApiKeyHealth();
    }
  }, [loading, needsSetup, showProfileSelect, activeProfile, checkApiKeyHealth]);

  const handleApiKeyUpdated = useCallback(() => {
    setApiKeyInvalid(false);
    checkApiKeyHealth();
  }, [checkApiKeyHealth]);

  const navigate = useCallback((pg, data = null) => {
    setNavStack((prev) => [...prev, { page: pageRef.current, selected: selectedRef.current }]);
    setSelected(data);
    setPage(pg);
  }, []);

  const navigateBack = useCallback(() => {
    setNavStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPage(last.page);
      setSelected(last.selected);
      return prev.slice(0, -1);
    });
  }, []);

  const requestPinAccess = useCallback((target) => {
    if (target?.profile && !target.profile.securityType) {
      setActiveProfile(target.profile);
      window.electron?.profiles?.setActiveProfile(target.profile.id);
      setShowProfileSelect(false);
      resetToHome();
      return;
    }
    setPinTarget(target);
    setShowSecurityOverlay(true);
  }, []);

  const handleSecuritySuccess = useCallback(() => {
    setShowSecurityOverlay(false);
    if (pinTarget?.type === 'login') {
      setRequiresAuth(false);
      setActiveProfile(pinTarget.profile);
    } else if (pinTarget?.type === 'profile-create') {
      setShowProfileSelect(true);
      setShowAddProfileForm(true);
    } else if (pinTarget?.profile) {
      setActiveProfile(pinTarget.profile);
      window.electron?.profiles?.setActiveProfile(pinTarget.profile.id);
      setShowProfileSelect(false);
      resetToHome();
    }
    setPinTarget(null);
  }, [pinTarget]);

  const handleSecurityCancel = useCallback(() => {
    setShowSecurityOverlay(false);
    if (pinTarget?.type === 'login') {
      setShowProfileSelect(true);
      setRequiresAuth(false);
    }
    setPinTarget(null);
  }, [pinTarget]);

  const handleProfileUpdated = useCallback(async () => {
    setProfileVersion((v) => v + 1);
    const currentId = activeProfileRef.current?.id;
    if (currentId) {
      const updated = await window.electron?.profiles?.getProfile(currentId);
      if (updated) {
        setActiveProfile(updated);
      } else {
        setActiveProfile(null);
        setShowProfileSelect(true);
      }
    }
  }, []);

  const handleLogoutConfirm = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    setActiveProfile(null);
    setShowProfileSelect(true);
    setPage('home');
    setSelected(null);
    setNavStack([]);
  }, []);

  const resetToHome = useCallback(() => {
    setPage('home');
    setSelected(null);
    setNavStack([]);
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
    if (!showSearch) {
      setSearchQuery('');
    }
  }, [showSearch]);

  useEffect(() => {
    window.electron?.getPlatform?.().then(setPlatform).catch(() => setPlatform('linux'));
  }, []);

  useEffect(() => {
    const mod = (e) => e.metaKey || e.ctrlKey;
    const handleKeyDown = (e) => {
      if (mod(e) && e.key === 'r') {
        e.preventDefault();
        window.location.reload();
        return;
      }
      if (mod(e) && e.key === 'z') {
        e.preventDefault();
        navigateBack();
      }
      if (mod(e) && e.key === 'f') {
        e.preventDefault();
        toggleSearch();
      }
      if (mod(e) && e.key === 'x') {
        e.preventDefault();
        handleLogoutConfirm();
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'Escape') {
        if (showSearch) toggleSearch();
        if (showShortcuts) setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBack, toggleSearch, showSearch, showShortcuts, handleLogoutConfirm]);

  const PageLoader = () => <LoadingScreen />;

  return (
    <div className="flex flex-col h-screen bg-background">
      {platform !== 'darwin' && <CustomTitlebar />}

      {loading ? (
        <SplashScreen />
      ) : needsSetup ? (
        <SetupScreen onComplete={() => { setNeedsSetup(false); setShowNotice(true); }} />
      ) : showSecurityOverlay ? (
        <SecurityOverlay
          target={pinTarget}
          onSuccess={handleSecuritySuccess}
          onCancel={handleSecurityCancel}
        />
      ) : showProfileSelect ? (
        <ProfileSelectScreen
          showAddForm={showAddProfileForm}
          onAddFormShown={() => setShowAddProfileForm(false)}
          onSelectProfile={(profile) => requestPinAccess({ type: 'profile-switch', profile })}
          onRequestMasterAuth={(target) => {
            setPinTarget(target);
            setShowSecurityOverlay(true);
          }}
        />
      ) : (
        <div className="flex flex-1 min-h-0">
          <Navbar
            key={profileVersion}
            activeProfile={activeProfile}
            onProfileSelect={requestPinAccess}
            onSearchToggle={toggleSearch}
            onNavigate={navigate}
            currentPage={page}
            onOpenHelp={() => setShowShortcuts(true)}
            onLogout={handleLogoutConfirm}
          />

        <div className="flex-1 flex flex-col min-w-0">
          {showShortcuts && (
            <HelpShortcutsModal onClose={() => setShowShortcuts(false)} />
          )}

          {showNotice && (
            <NoticeDialog
              onClose={() => setShowNotice(false)}
              onDontShowAgain={() => window.electron?.storage?.set('noticeDismissed', true)}
            />
          )}

          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
              <div className="w-full max-w-sm bg-surface rounded-xl overflow-hidden shadow-xl border border-border p-lg">
                <h3 className="text-lg font-bold text-text-primary mb-sm">Switch Profile?</h3>
                <p className="text-sm text-text-muted mb-lg">
                  You'll be signed out and returned to the profile selection screen.
                </p>
                <div className="flex gap-md">
                  <button
                    onClick={handleLogout}
                    className="flex-1 h-11 rounded-lg bg-accent hover:bg-accent-hover text-background text-sm font-medium transition-colors"
                  >
                    Switch
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 h-11 rounded-lg bg-surface-hover hover:bg-border text-text-primary text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {apiKeyInvalid && !showUpdateApiKey && (
            <div className="flex items-center gap-md px-lg py-sm bg-danger/10 border-b border-danger/20">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
              <p className="text-sm text-text-primary flex-1">
                Your TMDB API key is invalid. Content may not load correctly.
              </p>
              <button
                onClick={() => setShowUpdateApiKey(true)}
                className="btn-primary text-sm whitespace-nowrap"
              >
                Update API Key
              </button>
            </div>
          )}

          {showUpdateApiKey && (
            <UpdateApiKeyModal
              onClose={() => setShowUpdateApiKey(false)}
              onSaved={handleApiKeyUpdated}
            />
          )}

          {showSearch && (
            <Suspense fallback={<PageLoader />}>
              <SearchView
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onClose={toggleSearch}
                onSelect={(item) => {
                  toggleSearch();
                  navigate('detail', item);
                }}
                activeProfile={activeProfile}
              />
            </Suspense>
          )}

          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                {page === 'home' && <HomeView key={activeProfile?.id} activeProfile={activeProfile} onSelect={(item) => navigate('detail', item)} />}
                {page === 'library' && <LibraryView key={activeProfile?.id} activeProfile={activeProfile} onSelect={(item) => navigate('detail', item)} />}
                {page === 'detail' && selected && (
                  <DetailView
                    key={activeProfile?.id}
                    media={selected}
                    activeProfile={activeProfile}
                    onBack={navigateBack}
                    onSelect={(item) => navigate('detail', item)}
                  />
                )}
                {page === 'downloads' && <DownloadsPage key={activeProfile?.id} activeProfile={activeProfile} />}
                {page === 'notifications' && <NotificationView key={activeProfile?.id} activeProfile={activeProfile} onSelect={(item) => navigate('detail', item)} />}
                {page === 'settings' && <SettingsPage key={activeProfile?.id} activeProfile={activeProfile} onProfileUpdated={handleProfileUpdated} />}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      )}
      <UpdateNotification />
    </div>
  );
}

export default App;
