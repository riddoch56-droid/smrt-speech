import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../app/store';
import { backupToBlob, exportBackup, parseBackup, restoreBackup, type BackupFile, type RestoreMode } from '../platform/backup';
import { db, kvGet, kvSet } from '../platform/db';
import { localDate, shareFile } from '../platform/share';
import { Button, Modal, formatDateTime } from '../ui/kit';

function count(file: BackupFile, table: keyof BackupFile['tables']): number {
  const rows = file.tables[table];
  return Array.isArray(rows) ? rows.length : 0;
}

export function BackupPanel() {
  const [last, setLast] = useState<string | null>(null);
  const [since, setSince] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [typed, setTyped] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const l = await kvGet<string | null>('lastBackup', null);
    setLast(l);
    const sessions = await db.sessions.toArray();
    setSince(l ? sessions.filter((s) => s.startedAt > l).length : sessions.length);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const backUp = async () => {
    setBusy(true);
    setStatus('');
    try {
      const file = await exportBackup(db, __APP_VERSION__);
      const outcome = await shareFile(backupToBlob(file), `SMRTSpeech_backup_${localDate(new Date())}.json`, 'SMRT Speech backup');
      if (outcome === 'cancelled') {
        setStatus('Backup cancelled. Nothing was saved.');
      } else {
        await kvSet('lastBackup', new Date().toISOString());
        setStatus(outcome === 'downloaded' ? 'Backup downloaded. Keep the file somewhere safe.' : 'Backup shared. Keep the file somewhere safe.');
        await refresh();
      }
    } catch {
      setStatus('The backup could not be made. Please try again.');
    }
    setBusy(false);
  };

  const choose = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setRestoreStatus('');
    try {
      const parsed = parseBackup(await f.text());
      setMode('merge');
      setTyped('');
      setPending(parsed);
    } catch (err) {
      setRestoreStatus(err instanceof Error ? err.message : 'This file could not be read.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await restoreBackup(db, pending, mode);
      await useApp.getState().load();
      await refresh();
      setPending(null);
      setRestoreStatus(
        `Restored (${mode === 'merge' ? 'added to what was here' : 'replaced everything'}): ${r.patients} patients, ${r.sessions} sessions, ${r.customWords} custom words.`,
      );
    } catch (err) {
      setRestoreStatus(err instanceof Error ? `The restore failed: ${err.message}` : 'The restore failed. Nothing was changed.');
      setPending(null);
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <p className="notice warn">
        Removing the SMRT Speech icon from the Home Screen deletes all data on this iPad. Make a backup first, and keep it somewhere safe.
      </p>
      <p>
        {last ? `Last backup: ${formatDateTime(last)}.` : 'No backup has been made yet.'}{' '}
        {since === 1 ? '1 session has' : `${since} sessions have`} been saved since.
      </p>
      <div className="row">
        <Button icon="backup" variant="primary" onClick={() => void backUp()} disabled={busy} data-testid="backup-now">
          Back up now
        </Button>
        <Button icon="download" onClick={() => fileInput.current?.click()} disabled={busy}>
          Restore from backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="restore-file-input"
          onChange={(e) => void choose(e.target.files)}
        />
      </div>
      <p role="status" data-testid="backup-status">
        {status}
      </p>
      <p role="status" data-testid="restore-status">
        {restoreStatus}
      </p>

      {pending && (
        <Modal
          title="Restore from backup"
          onClose={() => setPending(null)}
          actions={
            <>
              <Button icon="close" variant="quiet" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                icon="tick"
                variant={mode === 'replace' ? 'danger' : 'primary'}
                disabled={busy || (mode === 'replace' && typed !== 'REPLACE')}
                onClick={() => void confirm()}
                data-testid="restore-confirm"
              >
                {mode === 'replace' ? 'Replace everything' : 'Add to what is here'}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p className="notice warn">Please read this before you continue.</p>
            <ul>
              <li>Made: {formatDateTime(pending.created)}</li>
              <li>Patients: {count(pending, 'patients')}</li>
              <li>Sessions: {count(pending, 'sessions')}</li>
              <li>Custom words: {count(pending, 'customWords')}</li>
            </ul>
            <div className="row">
              <Button icon="plus" selected={mode === 'merge'} onClick={() => setMode('merge')} data-testid="restore-merge">
                Add to what is here
              </Button>
              <Button icon="trash" selected={mode === 'replace'} onClick={() => setMode('replace')} data-testid="restore-replace">
                Replace everything
              </Button>
            </div>
            {mode === 'merge' ? (
              <p>Keeps everything on this iPad and adds what is in the file. Nothing here is deleted.</p>
            ) : (
              <div className="stack">
                <p className="notice warn">
                  This deletes all patients, sessions and custom words on this iPad and replaces them with the file. It cannot be undone.
                </p>
                <label className="field">
                  <span>Type REPLACE to confirm</span>
                  <input
                    className="input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    data-testid="restore-replace-input"
                  />
                </label>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
