import { useState, useEffect } from 'react';
import { User, Palette, Play, Download, Settings, Users, Database, RefreshCw, Info, MessageSquare } from 'lucide-react';
import { useSettings, applyAccentColor } from '../hooks/useSettings';
import GeneralSettings from '../components/settings/GeneralSettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import ProfilesSettings from '../components/settings/ProfilesSettings';
import PlaybackSettings from '../components/settings/PlaybackSettings';
import DataSettings from '../components/settings/DataSettings';
import AboutSettings from '../components/settings/AboutSettings';
import DownloadSettings from '../components/settings/DownloadSettings';
import FeedbackReport from '../components/settings/FeedbackReport';
import UpdateSettings from '../components/settings/UpdateSettings';
import SettingsFooter from '../components/settings/SettingsFooter';
import SettingsSection from '../components/settings/SettingsSection';

function SettingsPage({ activeProfile, onProfileUpdated }) {
  const isMaster = activeProfile?.isMaster;
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
    wyzieApiKey,
    setWyzieApiKey,
    subtitleLanguages,
    setSubtitleLanguages,
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

      <div className="space-y-lg">
        {isMaster && (
          <SettingsSection icon={Settings} title="General" description="API keys and global preferences">
            <GeneralSettings
              apiKey={apiKey}
              setApiKey={setApiKey}
              kidsFilterCountry={kidsFilterCountry}
              setKidsFilterCountry={setKidsFilterCountry}
              onSaveKidsCountry={saveKidsFilterCountry}
              activeProfile={activeProfile}
              wyzieApiKey={wyzieApiKey}
              setWyzieApiKey={setWyzieApiKey}
              subtitleLanguages={subtitleLanguages}
              setSubtitleLanguages={setSubtitleLanguages}
            />
          </SettingsSection>
        )}

        <SettingsSection icon={User} title="My Profile" description="Manage your avatar and security settings">
          <ProfileSettings activeProfile={activeProfile} onSaved={handleProfilesSaved} />
        </SettingsSection>

        {isMaster && (
          <SettingsSection icon={Users} title="Members" description="Add, edit, or remove profiles">
            <ProfilesSettings
              profiles={profiles}
              profilesLoading={profilesLoading}
              onAddProfile={handleAddProfile}
              onDeleteProfile={handleDeleteProfile}
              onSaved={handleProfilesSaved}
            />
          </SettingsSection>
        )}

        <SettingsSection icon={Palette} title="Appearance" description="Customize the look and feel of the app">
          <AppearanceSettings
            pendingAccentColor={pendingAccentColor}
            setPendingAccentColor={setPendingAccentColor}
            onSaveAccentColor={handleSaveAccentColor}
          />
        </SettingsSection>

        <SettingsSection icon={Play} title="Playback" description="Configure streaming sources and auto-watch behavior">
          <PlaybackSettings activeProfile={activeProfile} onProfileUpdated={onProfileUpdated} />
        </SettingsSection>

        <SettingsSection icon={Download} title="Downloads" description="Manage download paths and the downloader binary">
          <DownloadSettings activeProfile={activeProfile} onProfileUpdated={onProfileUpdated} />
        </SettingsSection>

        {isMaster && (
          <SettingsSection icon={Database} title="Memory & Data" description="Manage cache, export, and data storage">
            <DataSettings />
          </SettingsSection>
        )}

        <SettingsSection icon={RefreshCw} title="Updates" description="Check for new versions and manage update preferences">
          <UpdateSettings />
        </SettingsSection>

        <SettingsSection icon={MessageSquare} title="Feedback" description="Report issues or suggest features">
          <FeedbackReport activeProfile={activeProfile} />
        </SettingsSection>

        <SettingsSection icon={Info} title="About" description="App information and features">
          <AboutSettings />
        </SettingsSection>

        <SettingsFooter />
      </div>
    </div>
  );
}

export default SettingsPage;
