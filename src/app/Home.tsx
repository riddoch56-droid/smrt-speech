import { useEffect, useState } from 'react';
import { db, kvGet } from '../platform/db';
import { activitiesFor, MODULES } from '../session/types';
import { asset, BRAND_MARK, MODULE_ART } from '../ui/assets';
import { backupDue, GUEST } from '../settings/model';
import { Icon } from '../ui/Icon';
import { Button, Modal } from '../ui/kit';
import { navigate } from './router';
import { currentPatient, useApp } from './store';

export function Wordmark() {
  return (
    <div className="wordmark">
      <img src={asset(BRAND_MARK)} alt="" />
      <span>
        SMRT <span className="light">Speech</span>
      </span>
    </div>
  );
}

function PatientPicker({ onClose }: { onClose(): void }) {
  const patients = useApp((s) => s.patients);
  const current = useApp((s) => s.currentPatientId);
  const setCurrent = useApp((s) => s.setCurrentPatient);
  const active = patients.filter((p) => !p.archived).sort((a, b) => a.code.localeCompare(b.code));
  const choose = async (id: string) => {
    await setCurrent(id);
    onClose();
  };
  return (
    <Modal
      title="Who is this session for?"
      onClose={onClose}
      actions={
        <>
          <Button
            icon="users"
            onClick={() => {
              onClose();
              navigate('/patients');
            }}
          >
            Manage patients
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <button type="button" className="list-item" onClick={() => choose(GUEST)} data-testid="pick-guest">
          <Icon name="eye" size={32} />
          <span className="grow">
            <span className="title">Guest</span>
            <span className="muted small" style={{ display: 'block' }}>
              Practice without saving. Nothing is stored.
            </span>
          </span>
          {current === GUEST && <Icon name="tick" size={30} />}
        </button>
        {active.map((p) => (
          <button type="button" key={p.id} className="list-item" onClick={() => choose(p.id)} data-testid={`pick-${p.code}`}>
            <Icon name="user" size={32} />
            <span className="grow title">{p.code}</span>
            {current === p.id && <Icon name="tick" size={30} />}
          </button>
        ))}
        {active.length === 0 && <p className="muted">No patients yet. Use Manage patients to add one.</p>}
      </div>
    </Modal>
  );
}

export function Home() {
  const state = useApp();
  const [picking, setPicking] = useState(false);
  const [backupReminder, setBackupReminder] = useState(false);
  const patient = currentPatient(state);
  const guest = state.currentPatientId === GUEST;

  useEffect(() => {
    let live = true;
    void (async () => {
      const lastBackup = await kvGet<string | null>('lastBackup', null);
      const since = lastBackup ? await db.sessions.where('startedAt').above(lastBackup).toArray() : await db.sessions.toArray();
      const oldest = since.map((s) => s.startedAt).sort()[0] ?? null;
      if (live) setBackupReminder(backupDue({ lastBackup, oldestUnsaved: oldest, sessionsSince: since.length }, new Date()));
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="screen">
      <header className="topbar">
        <div className="grow">
          <Wordmark />
        </div>
        <Button icon="users" onClick={() => navigate('/patients')} data-testid="nav-patients">
          Patients
        </Button>
        <Button icon="settings" onClick={() => navigate('/settings')} data-testid="nav-settings">
          Settings
        </Button>
      </header>
      <main className="page">
        <div className="page-inner">
          <div className="patient-bar" data-testid="patient-bar">
            <Icon name={guest ? 'eye' : 'user'} size={36} />
            <div className="grow">
              <div className="small muted">{guest ? 'Practice mode' : 'Current patient'}</div>
              <div className="who" data-testid="current-patient">
                {guest ? 'Guest (nothing saved)' : (patient?.code ?? 'No patient selected')}
              </div>
            </div>
            {patient && (
              <Button icon="chart" onClick={() => navigate(`/history/${patient.id}`)}>
                History
              </Button>
            )}
            <Button icon="flip" variant="primary" onClick={() => setPicking(true)} data-testid="switch-patient">
              {state.currentPatientId ? 'Switch' : 'Choose patient'}
            </Button>
          </div>

          {backupReminder && (
            <div className="notice warn row spread" data-testid="backup-reminder">
              <span>It is time to back up your data.</span>
              <Button icon="backup" onClick={() => navigate('/settings')}>
                Back up
              </Button>
            </div>
          )}

          <div className="tiles">
            {MODULES.map((m) => (
              <button
                type="button"
                key={m.id}
                className="tile"
                data-module={m.id}
                onClick={() => navigate(`/module/${m.id}`)}
                data-testid={`module-${m.id}`}
              >
                <span className="art">
                  <img src={asset(MODULE_ART[m.id])} alt="" />
                </span>
                <span>
                  <span className="name">{m.title}</span>
                  <span className="muted" style={{ display: 'block' }}>
                    {m.blurb}
                  </span>
                  <span className="count">{activitiesFor(m.id).length} activities</span>
                </span>
              </button>
            ))}
          </div>
          <p className="muted small" style={{ textAlign: 'center' }}>
            A practice toolkit for use by a speech and language therapist. It does not diagnose or treat any condition.
          </p>
        </div>
      </main>
      {picking && <PatientPicker onClose={() => setPicking(false)} />}
    </div>
  );
}
