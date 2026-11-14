import { useState, type ReactNode } from 'react';
import { useApp } from '../app/store';
import { navigate } from '../app/router';
import { Button, Field, Screen } from '../ui/kit';
import { hashPin, isValidPin, verifyPin } from '../platform/system';

export function PinGate({ children }: { children: ReactNode }) {
  const pin = useApp((s) => s.pin);
  const unlocked = useApp((s) => s.unlocked);
  const setPin = useApp((s) => s.setPin);
  const [entry, setEntry] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetWord, setResetWord] = useState('');

  if (!pin || unlocked) return <>{children}</>;

  const press = async (digit: string) => {
    if (busy || entry.length >= 4) return;
    const next = entry + digit;
    setEntry(next);
    setMessage('');
    if (next.length === 4) {
      setBusy(true);
      const ok = await verifyPin(next, pin);
      setBusy(false);
      if (ok) {
        useApp.getState().unlock();
      } else {
        setEntry('');
        setMessage('That PIN did not match. Please try again.');
      }
    }
  };

  const reset = async () => {
    await setPin(null);
  };

  return (
    <Screen
      title="Enter PIN"
      actions={
        <Button icon="home" variant="quiet" onClick={() => navigate('/')} data-testid="pin-home">
          Home
        </Button>
      }
    >
      <div data-testid="pin-gate" className="stack" style={{ alignItems: 'center', gap: 24 }}>
        <p>Enter your 4-digit PIN to open this screen.</p>
        <div className="pin-dots" aria-label={`${entry.length} of 4 digits entered`} role="img">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < entry.length ? 'on' : ''} />
          ))}
        </div>
        <p className="error" role="status" style={{ minHeight: 28 }}>
          {message}
        </p>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Button key={d} onClick={() => void press(d)} data-testid={`pin-key-${d}`}>
              {d}
            </Button>
          ))}
          <span />
          <Button onClick={() => void press('0')} data-testid="pin-key-0">
            0
          </Button>
          <Button icon="back" label="Delete last digit" onClick={() => setEntry(entry.slice(0, -1))} />
        </div>
        {!forgot ? (
          <Button icon="info" variant="quiet" onClick={() => setForgot(true)} data-testid="pin-forgot">
            Forgot PIN
          </Button>
        ) : (
          <div className="card stack" style={{ maxWidth: 480 }}>
            <p>
              To remove the PIN, type the word RESET. No patient data is deleted. You can set a new PIN later in
              Settings.
            </p>
            <Field label="Type RESET">
              <input
                className="input"
                value={resetWord}
                onChange={(e) => setResetWord(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                data-testid="pin-reset-input"
              />
            </Field>
            <div className="row">
              <Button
                icon="tick"
                variant="primary"
                disabled={resetWord.trim().toUpperCase() !== 'RESET'}
                onClick={() => void reset()}
                data-testid="pin-reset-confirm"
              >
                Remove PIN
              </Button>
              <Button icon="close" variant="quiet" onClick={() => setForgot(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}

export function PinSettings() {
  const pin = useApp((s) => s.pin);
  const setPin = useApp((s) => s.setPin);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');

  const save = async () => {
    if (!isValidPin(value)) {
      setStatus('A PIN must be exactly 4 digits.');
      return;
    }
    await setPin(await hashPin(value));
    setValue('');
    setStatus('PIN saved.');
  };

  const remove = async () => {
    await setPin(null);
    setValue('');
    setStatus('PIN removed.');
  };

  return (
    <div className="card stack">
      <h2>Privacy PIN</h2>
      <p>{pin ? 'A PIN is set.' : 'No PIN is set.'}</p>
      <p className="muted">
        This is a privacy screen to stop someone browsing other records, not strong security. If you forget the PIN,
        type RESET on the PIN screen to remove it. No data is deleted.
      </p>
      <Field label={pin ? 'New 4-digit PIN' : '4-digit PIN'}>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          data-testid="pin-new-input"
        />
      </Field>
      <div className="row">
        <Button icon="save" variant="primary" disabled={!isValidPin(value)} onClick={() => void save()} data-testid="pin-save">
          {pin ? 'Change PIN' : 'Set PIN'}
        </Button>
        {pin && (
          <Button icon="trash" onClick={() => void remove()} data-testid="pin-remove">
            Remove PIN
          </Button>
        )}
      </div>
      <p role="status" className="small">
        {status}
      </p>
    </div>
  );
}
