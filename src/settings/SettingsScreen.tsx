import { useEffect, useState, type ReactNode } from 'react';
import { navigate } from '../app/router';
import { useApp } from '../app/store';
import { PinSettings } from '../patients/PinGate';
import { englishVoices, hasUkVoice, onVoicesChanged, speak, speechSupported, type VoiceInfo } from '../platform/speech';
import { requestPersistence, storageStatus, type StorageStatus } from '../platform/system';
import { Icon } from '../ui/Icon';
import { Button, Field, Screen, Segmented, Toggle } from '../ui/kit';
import { BackupPanel } from './BackupPanel';
import type { CustomFoils, LetterSounds, ThemeChoice } from './model';
import { OfflinePanel } from './OfflinePanel';

function Card({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="card stack">
      <h2 className="card-title">
        <Icon name={icon} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function voiceLabel(v: VoiceInfo): string {
  return `${v.name} (${v.lang})${v.local ? ', on this iPad' : ', online'}`;
}

export function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const practitioner = useApp((s) => s.practitioner);
  const updateSettings = useApp((s) => s.updateSettings);
  const setPractitioner = useApp((s) => s.setPractitioner);

  const [draft, setDraft] = useState(practitioner);
  const [saved, setSaved] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>(() => englishVoices());
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => onVoicesChanged(() => setVoices(englishVoices())), []);
  useEffect(() => {
    void storageStatus().then(setStorage);
  }, []);

  const field = (key: keyof typeof draft, label: string, testid: string, help?: string) => (
    <Field label={label} help={help}>
      <input
        className="input"
        value={draft[key]}
        data-testid={testid}
        onChange={(e) => {
          setSaved(false);
          setDraft({ ...draft, [key]: e.target.value });
        }}
      />
    </Field>
  );

  const showUkNotice = speechSupported() && voices.length > 0 && !hasUkVoice();

  return (
    <Screen title="Settings" back="/">
      <div className="stack" data-testid="settings-screen">
        <Card title="Practitioner profile" icon="user">
          <p className="muted">Used only in report headers.</p>
          {field('name', 'Name', 'practitioner-name')}
          {field('credentials', 'Credentials', 'practitioner-credentials')}
          {field('practice', 'Practice name', 'practitioner-practice')}
          {field('contact', 'Contact line (optional)', 'practitioner-contact')}
          <div className="row">
            <Button
              icon="save"
              variant="primary"
              onClick={() => {
                void setPractitioner({
                  name: draft.name.trim(),
                  credentials: draft.credentials.trim(),
                  practice: draft.practice.trim(),
                  contact: draft.contact.trim(),
                }).then(() => setSaved(true));
              }}
              data-testid="save-practitioner"
            >
              Save
            </Button>
            {saved && <span role="status">Saved</span>}
          </div>
        </Card>

        <Card title="Appearance" icon="accessibility">
          <div data-testid="setting-theme">
            <Segmented<ThemeChoice>
              label="Theme for menus, records and settings"
              value={settings.theme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Match this iPad' },
              ]}
              onChange={(v) => void updateSettings({ theme: v })}
            />
          </div>
          <p className="muted">Activities always stay on a white background with dark text, whichever theme is chosen.</p>
        </Card>

        <Card title="Session behaviour" icon="progress">
          <div data-testid="setting-auto-advance">
            <Toggle
              label="Auto-advance"
              help="Moves on after a correct answer. When off, a Next button is shown."
              checked={settings.autoAdvance}
              onChange={(v) => void updateSettings({ autoAdvance: v })}
            />
          </div>
          <div data-testid="setting-show-score">
            <Toggle
              label="Show score during the session"
              help="Scores are always recorded and always appear in reports, whatever this is set to."
              checked={settings.showScore}
              onChange={(v) => void updateSettings({ showScore: v })}
            />
          </div>
          <div data-testid="setting-child-friendly">
            <Toggle
              label="Child-friendly"
              help="Hides adult-themed words."
              checked={settings.childFriendly}
              onChange={(v) => void updateSettings({ childFriendly: v })}
            />
          </div>
          <div data-testid="setting-sound">
            <Toggle label="Sound effects" checked={settings.soundEffects} onChange={(v) => void updateSettings({ soundEffects: v })} />
          </div>
        </Card>

        <Card title="Voice" icon="voice">
          {!speechSupported() ? (
            <p className="notice warn">Spoken words are not available in this browser, so the app cannot read words aloud here.</p>
          ) : (
            <>
              {showUkNotice && (
                <p className="notice warn" role="status">
                  No English (UK) voice is installed. To add one on the iPad: open Settings, then Accessibility, then Read &amp; Speak (or
                  Spoken Content), then Voices, then English, and choose an English (UK) voice and download it. Then return here.
                </p>
              )}
              <Field label="Voice">
                <select
                  className="input"
                  value={settings.voiceUri ?? ''}
                  data-testid="voice-select"
                  onChange={(e) => void updateSettings({ voiceUri: e.target.value || null })}
                >
                  <option value="">Automatic (best English voice)</option>
                  {voices.map((v) => (
                    <option key={v.uri} value={v.uri}>
                      {voiceLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Speech rate: ${settings.speechRate.toFixed(2)}`}>
                <input
                  type="range"
                  min={0.6}
                  max={1.2}
                  step={0.05}
                  value={settings.speechRate}
                  data-testid="voice-rate"
                  onChange={(e) => void updateSettings({ speechRate: Number(e.target.value) })}
                />
              </Field>
              <div className="row">
                <Button icon="speaker" onClick={() => speak('This is how I sound. Please point to the picture of the cup.')} data-testid="voice-test">
                  Test
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card title="Letter sounds for tiles" icon="tile">
          <Segmented<LetterSounds>
            label="When a letter tile is touched"
            value={settings.letterSounds}
            options={[
              { value: 'names', label: 'Say the letter name' },
              { value: 'click', label: 'Click only' },
              { value: 'silent', label: 'Silent' },
            ]}
            onChange={(v) => void updateSettings({ letterSounds: v })}
          />
        </Card>

        <Card title="Custom-word foils" icon="category">
          <Segmented<CustomFoils>
            label="Wrong choices for custom words"
            value={settings.customFoils}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'limited', label: 'Limited' },
            ]}
            onChange={(v) => void updateSettings({ customFoils: v })}
          />
          <p className="muted">
            {settings.customFoils === 'full'
              ? 'Full: custom words can appear alongside built-in words as wrong choices.'
              : 'Limited: custom categories only use their own words as wrong choices.'}
          </p>
        </Card>

        <Card title="Words and pictures" icon="customWords">
          <div className="row">
            <Button icon="list" onClick={() => navigate('/settings/words')}>
              Word management
            </Button>
            <Button icon="plus" onClick={() => navigate('/settings/my-words')}>
              My words
            </Button>
            <Button icon="book" onClick={() => navigate('/settings/my-reading')}>
              My reading items
            </Button>
            <Button icon="info" onClick={() => navigate('/settings/credits')}>
              Image credits
            </Button>
          </div>
        </Card>

        <Card title="Privacy lock" icon="privacy">
          <PinSettings />
        </Card>

        <Card title="Offline use" icon="offline">
          <OfflinePanel />
        </Card>

        <Card title="Backup" icon="backup">
          <BackupPanel />
        </Card>

        <Card title="Storage" icon="archive">
          {storage === null ? (
            <p>Checking...</p>
          ) : (
            <>
              <p>
                {storage.supported
                  ? storage.persisted
                    ? 'Storage is persistent: the iPad will not clear this data to free space.'
                    : 'Storage is not yet persistent: the iPad could clear this data if it runs short of space.'
                  : 'Storage status is not available in this browser.'}
              </p>
              {storage.usageMb !== null && (
                <p className="muted">
                  Used: {storage.usageMb} MB{storage.quotaMb !== null ? ` of about ${storage.quotaMb} MB available` : ''}
                </p>
              )}
              {storage.supported && !storage.persisted && (
                <div className="row">
                  <Button
                    icon="lock"
                    onClick={() => {
                      void requestPersistence().then(() => storageStatus().then(setStorage));
                    }}
                  >
                    Request persistent storage
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="About" icon="info">
          <p>
            SMRT Speech version <span data-testid="app-version">{__APP_VERSION__}</span>, built {__BUILD_DATE__}.
          </p>
          <p>All data stays on this device. Nothing is transmitted.</p>
          <p>This is an informal practice toolkit. It is not a diagnostic or treatment device.</p>
        </Card>
      </div>
    </Screen>
  );
}
