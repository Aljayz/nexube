import { useState, useEffect, useRef } from 'react';
import { Home, Library, Download, Bell, Settings, Search, User, HelpCircle, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

function Navbar({ activeProfile, onProfileSelect, onSearchToggle, onNavigate, currentPage, onOpenHelp, onLogout }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        onSearchToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchToggle]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const list = await window.electron?.profiles?.listProfiles();
      if (list) setProfiles(list);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  }

  async function handleAddProfile() {
    const masterProfile = profiles.find((p) => p.isMaster);
    if (masterProfile) {
      onProfileSelect({ type: 'profile-create', profile: masterProfile });
    }
    setShowProfileMenu(false);
  }

  return (
    <nav className="flex flex-col w-19 h-full bg-surface border-r border-accent/30">
      <div className="flex items-center justify-center px-sm py-lg border-b border-accent/30">
        <img src="/Logo.png" alt="Nexube" className="w-8 h-8" />
      </div>

      <div className="flex-1 flex flex-col items-center py-md gap-xs">
        <button
          onClick={onSearchToggle}
          onMouseEnter={() => setHoveredItem('search')}
          onMouseLeave={() => setHoveredItem(null)}
          className="relative flex items-center justify-center w-10 h-10 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 hover:border hover:border-accent/50 border border-transparent transition-colors"
        >
          <Search className="w-5 h-5" />
          {hoveredItem === 'search' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-surface border border-accent/40 rounded text-xs text-text-primary whitespace-nowrap z-40">
              Search <span className="text-text-muted ml-1">Ctrl+F</span>
            </div>
          )}
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 border ${
                currentPage === item.id
                  ? 'bg-accent/10 text-accent border-accent/50'
                  : 'text-text-muted hover:text-accent hover:bg-accent/10 hover:border-accent/50 border-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
              {hoveredItem === item.id && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-surface border border-accent/50 rounded text-xs text-text-primary whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center px-sm py-md border-t border-accent/30 gap-xs">
        <button
          onClick={onOpenHelp}
          onMouseEnter={() => setHoveredItem('help')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 border ${
            currentPage === 'help'
              ? 'bg-accent/10 text-accent border-accent/50'
              : 'text-text-muted hover:text-accent hover:bg-accent/10 hover:border-accent/50 border-transparent'
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          {hoveredItem === 'help' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-surface border border-accent/50 rounded text-xs text-text-primary whitespace-nowrap z-50">
              Help & Shortcuts
            </div>
          )}
        </button>

        <button
          onClick={() => onNavigate('settings')}
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 border ${
            currentPage === 'settings'
              ? 'bg-accent/10 text-accent border-accent/50'
              : 'text-text-muted hover:text-accent hover:bg-accent/10 hover:border-accent/50 border-transparent'
          }`}
        >
          <Settings className="w-5 h-5" />
          {hoveredItem === 'settings' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-surface border border-accent/50 rounded text-xs text-text-primary whitespace-nowrap z-50">
              Settings
            </div>
          )}
        </button>

        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 border ${
              showProfileMenu
                ? 'bg-accent/10 text-accent border-accent/50'
                : 'text-text-muted hover:text-accent hover:bg-accent/10 hover:border-accent/50 border-transparent'
            }`}
          >
            <User className="w-5 h-5" />
          </button>

          {showProfileMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1 mb-2 w-52 bg-surface border border-accent/50 rounded-lg shadow-lg overflow-hidden z-50">
              <div className="p-sm border-b border-accent/30">
                <p className="text-xs text-text-muted uppercase tracking-wider text-center">Switch Profile</p>
              </div>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    onProfileSelect({ type: 'profile-switch', profile });
                    setShowProfileMenu(false);
                  }}
                  className={`w-full px-md py-sm text-left text-sm transition-colors flex items-center gap-sm ${
                    activeProfile?.id === profile.id
                      ? 'text-accent bg-accent/10'
                      : 'text-text-primary hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0 overflow-hidden"
                    style={{ backgroundColor: profile.avatarColor || '#00E5FF' }}
                  >
                    {profile.avatar ? (
                      <img
                        src={profile.avatar.startsWith('/') || profile.avatar.startsWith('file:') ? profile.avatar : `/${profile.avatar}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="truncate">
                    {profile.name}
                    {profile.isKids && (
                      <span className="ml-1 text-xs text-accent">(Kids)</span>
                    )}
                  </span>
                  {activeProfile?.id === profile.id && (
                    <span className="text-xs ml-auto">Active</span>
                  )}
                </button>
              ))}
              <div className="border-t border-accent/30">
                <button
                  onClick={handleAddProfile}
                  className="w-full px-md py-sm text-left text-sm text-accent hover:bg-accent/10 transition-colors"
                >
                  + Add Profile
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          onMouseEnter={() => setHoveredItem('logout')}
          onMouseLeave={() => setHoveredItem(null)}
          className="relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium text-danger/70 hover:text-danger hover:bg-danger/10 hover:border-danger/50 border border-transparent transition-colors duration-200"
        >
          <LogOut className="w-5 h-5" />
          {hoveredItem === 'logout' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-surface border border-danger/50 rounded text-xs text-text-primary whitespace-nowrap z-50">
              Switch Profile
            </div>
          )}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
