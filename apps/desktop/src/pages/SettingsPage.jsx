import { useState, useEffect } from 'react';
import { useSettings, applyAccentColor } from '../hooks/useSettings';
import GeneralSettings from '../components/settings/GeneralSettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import ProfilesSettings from '../components/settings/ProfilesSettings';
import PlaybackSettings from '../components/settings/PlaybackSettings';
import DataSettings from '../components/settings/DataSettings';
import AboutSettings from '../components/settings/AboutSettings';
import DownloadSettings from '../components/settings/DownloadSettings';

const ALL_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'profiles', label: 'Members' },
  { id: 'playback', label: 'Playback' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'data', label: 'Memory & Data' },
  { id: 'about', label: 'About' },
];

const RESTRICTED_TABS = ['profile', 'appearance', 'playback', 'downloads', 'about'];

function SettingsPage({ activeProfile, onProfileUpdated }) {
  const isMaster = activeProfile?.isMaster;
  const TABS = isMaster ? ALL_TABS : ALL_TABS.filter((t) => RESTRICTED_TABS.includes(t.id));
  const [activeTab, setActiveTab] = useState('profile');
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [pendingAccentColor, setPendingAccentColor] = useState(activeProfile?.accentColor || '#00E5FF');

  useEffect(() => {
    setPendingAccentColor(activeProfile?.accentColor || '#00E5FF');
  }, [activeProfile]);

  async function loadProfiles() {
    try {
      const profilesList = await window.electron?.profiles?.listProfiles();
      if (profilesList) setProfiles(profilesList);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  }

  useEffect(() => {
    (async () => {
      setProfilesLoading(true);
      await loadProfiles();
      setProfilesLoading(false);
    })();
  }, []);

  const {
    apiKey,
    setApiKey,
    kidsFilterCountry,
    setKidsFilterCountry,
    saveKidsFilterCountry,
  } = useSettings();

  const handleAddProfile = async (input) => {
    const profile = await window.electron?.profiles?.createProfile(input);
    if (profile) {
      setProfiles((prev) => [...prev, profile]);
    }
    return profile;
  };

  const handleDeleteProfile = async (id) => {
    await window.electron?.profiles?.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleProfilesSaved = () => {
    loadProfiles();
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleSaveAccentColor = async (color) => {
    await window.electron?.profiles?.updateProfile(activeProfile.id, { accentColor: color });
    applyAccentColor(color);
    if (onProfileUpdated) onProfileUpdated();
  };

  return (
    <div className="px-lg py-lg max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-lg">Settings</h1>

      <div className="flex gap-xs mb-lg border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <ProfileSettings activeProfile={activeProfile} onSaved={handleProfilesSaved} />
      )}

      {activeTab === 'general' && (
        <GeneralSettings
          apiKey={apiKey}
          setApiKey={setApiKey}
          kidsFilterCountry={kidsFilterCountry}
          setKidsFilterCountry={setKidsFilterCountry}
          onSaveKidsCountry={saveKidsFilterCountry}
          activeProfile={activeProfile}
        />
      )}

      {activeTab === 'appearance' && (
        <AppearanceSettings
          pendingAccentColor={pendingAccentColor}
          setPendingAccentColor={setPendingAccentColor}
          onSaveAccentColor={handleSaveAccentColor}
        />
      )}

      {activeTab === 'profiles' && (
        <ProfilesSettings
          profiles={profiles}
          profilesLoading={profilesLoading}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          onSaved={handleProfilesSaved}
        />
      )}

      {activeTab === 'playback' && (
        <PlaybackSettings activeProfile={activeProfile} onProfileUpdated={onProfileUpdated} />
      )}

      {activeTab === 'downloads' && <DownloadSettings activeProfile={activeProfile} onProfileUpdated={onProfileUpdated} />}

      {activeTab === 'data' && <DataSettings />}

      {activeTab === 'about' && <AboutSettings />}
    </div>
  );
}

export default SettingsPage;
