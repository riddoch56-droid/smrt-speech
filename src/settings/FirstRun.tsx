import { useEffect, useState } from 'react';
import { Wordmark } from '../app/Home';
import { useApp } from '../app/store';
import { requestPersistence } from '../platform/system';
import { Button, Field } from '../ui/kit';
import { OfflinePanel } from './OfflinePanel';

const STEPS = 3;

export function FirstRun() {
  const practitioner = useApp((s) => s.practitioner);
  const setPractitioner = useApp((s) => s.setPractitioner);
  const completeFirstRun = useApp((s) => s.completeFirstRun);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(practitioner);

  useEffect(() => {
    void requestPersistence();
  }, []);

  const set = (key: keyof typeof draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const nameOk = draft.name.trim().length > 0;

  const next = async () => {
    if (step === 2) {
      await setPractitioner({
        name: draft.name.trim(),
        credentials: draft.credentials.trim(),
        practice: draft.practice.trim(),
        contact: draft.contact.trim(),
      });
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="screen" data-testid="first-run">
      <main className="page">
        <div className="page-inner stack">
          <Wordmark />
          <p className="muted">
            Step {step} of {STEPS}
          </p>

          {step === 1 && (
            <section className="card stack">
              <h1>Welcome to SMRT Speech</h1>
              <p>
                SMRT Speech is a word-level practice toolkit for use by a speech and language therapist: comprehension, naming, reading and
                writing activities, with session records and reports.
              </p>
              <p className="notice good">
                Patients are identified by an ID code only, never a name. All data stays on this iPad and nothing is transmitted.
              </p>
              <p>This is an informal practice toolkit. It is not a diagnostic or treatment device.</p>
            </section>
          )}

          {step === 2 && (
            <section className="card stack">
              <h1>Your details</h1>
              <p className="muted">These appear only in the headers of reports you create. Only your name is required.</p>
              <Field label="Name">
                <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} data-testid="first-run-name" />
              </Field>
              <Field label="Credentials (optional)">
                <input className="input" value={draft.credentials} onChange={(e) => set('credentials', e.target.value)} />
              </Field>
              <Field label="Practice name (optional)">
                <input className="input" value={draft.practice} onChange={(e) => set('practice', e.target.value)} />
              </Field>
              <Field label="Contact line (optional)">
                <input className="input" value={draft.contact} onChange={(e) => set('contact', e.target.value)} />
              </Field>
            </section>
          )}

          {step === 3 && (
            <section className="card stack">
              <h1>Get ready to work offline</h1>
              <p>
                The pictures are stored on this iPad now, so the app works without a connection. You can start using the app before this
                finishes and resume it later from Settings.
              </p>
              <OfflinePanel autoStart />
            </section>
          )}

          <div className="row">
            {step < STEPS && (
              <Button
                icon="next"
                variant="primary"
                big
                disabled={step === 2 && !nameOk}
                onClick={() => void next()}
                data-testid="first-run-next"
              >
                Next
              </Button>
            )}
            {step === STEPS && (
              <>
                <Button icon="tick" variant="primary" big onClick={() => void completeFirstRun()} data-testid="first-run-finish">
                  Finish
                </Button>
                <Button icon="skip" variant="quiet" onClick={() => void completeFirstRun()} data-testid="first-run-skip">
                  Skip for now
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
