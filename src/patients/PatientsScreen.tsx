import { useState } from 'react';
import { useApp } from '../app/store';
import { navigate } from '../app/router';
import { db, type Patient } from '../platform/db';
import { uid } from '../session/rng';
import { localDate } from '../platform/share';
import { Button, Field, Modal, Screen, formatDate } from '../ui/kit';

interface Draft {
  id: string | null;
  code: string;
  dateAdded: string;
  notes: string;
  archived: boolean;
}

export function PatientsScreen() {
  const patients = useApp((s) => s.patients);
  const currentId = useApp((s) => s.currentPatientId);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Patient | null>(null);
  const [typed, setTyped] = useState('');

  const q = search.trim().toLowerCase();
  const visible = patients
    .filter((p) => (showArchived ? true : !p.archived))
    .filter((p) => !q || p.code.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));

  const openAdd = () => {
    setError('');
    setDraft({ id: null, code: '', dateAdded: localDate(new Date()), notes: '', archived: false });
  };

  const openEdit = (p: Patient) => {
    setError('');
    setDraft({ id: p.id, code: p.code, dateAdded: p.dateAdded ?? '', notes: p.notes, archived: p.archived });
  };

  const save = async () => {
    if (!draft) return;
    const code = draft.code.trim();
    if (!code) {
      setError('Please enter an ID code.');
      return;
    }
    const clash = patients.some((p) => p.id !== draft.id && p.code.toLowerCase() === code.toLowerCase());
    if (clash) {
      setError('That ID code is already in use.');
      return;
    }
    const record: Patient = {
      id: draft.id ?? uid(),
      code,
      dateAdded: draft.dateAdded || null,
      notes: draft.notes,
      archived: draft.archived,
    };
    await db.patients.put(record);
    await useApp.getState().refreshPatients();
    setDraft(null);
  };

  const toggleArchive = async () => {
    if (!draft || !draft.id) return;
    const next = !draft.archived;
    await db.patients.update(draft.id, { archived: next });
    await useApp.getState().refreshPatients();
    setDraft(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await db.sessions.where('patientId').equals(deleting.id).delete();
    await db.patients.delete(deleting.id);
    await useApp.getState().refreshPatients();
    setDeleting(null);
    setTyped('');
  };

  const select = async (id: string) => {
    await useApp.getState().setCurrentPatient(id);
    navigate('/');
  };

  return (
    <Screen
      title="Patients"
      back="/"
      actions={
        <Button icon="plus" variant="primary" onClick={openAdd} data-testid="add-patient">
          Add patient
        </Button>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="row">
          <div className="grow">
            <input
              className="input"
              type="search"
              placeholder="Search by ID code or notes"
              aria-label="Search patients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="patient-search"
            />
          </div>
          <Button
            icon={showArchived ? 'tick' : 'archive'}
            selected={showArchived}
            aria-pressed={showArchived}
            onClick={() => setShowArchived(!showArchived)}
            data-testid="show-archived"
          >
            Show archived
          </Button>
        </div>

        {visible.length === 0 && (
          <div className="notice">
            {patients.length === 0
              ? 'No patients yet. Choose Add patient to create one. Use an ID code, not a name.'
              : 'No patients match.'}
          </div>
        )}

        <div className="list">
          {visible.map((p) => (
            <div key={p.id} className="list-item" data-testid={`patient-row-${p.code}`}>
              <div className="grow">
                <div className="title">
                  {p.code}{' '}
                  {p.id === currentId && <span className="tag good">Selected</span>}{' '}
                  {p.archived && <span className="tag warn">Archived</span>}
                </div>
                <div className="small muted">
                  {p.dateAdded ? `Added ${formatDate(p.dateAdded)}` : 'No date added'}
                  {p.notes ? ` · ${p.notes.slice(0, 80)}` : ''}
                </div>
              </div>
              <div className="row">
                <Button icon="tick" variant="primary" onClick={() => void select(p.id)} data-testid={`select-${p.code}`}>
                  Select
                </Button>
                <Button icon="chart" onClick={() => navigate(`/history/${p.id}`)} data-testid={`history-${p.code}`}>
                  History
                </Button>
                <Button icon="edit" onClick={() => openEdit(p)} data-testid={`edit-${p.code}`}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {draft && (
        <Modal
          title={draft.id ? 'Edit patient' : 'Add patient'}
          onClose={() => setDraft(null)}
          actions={
            <>
              <Button icon="save" variant="primary" onClick={() => void save()} data-testid="save-patient">
                Save
              </Button>
              {draft.id && (
                <>
                  <Button icon="archive" onClick={() => void toggleArchive()} data-testid="archive-patient">
                    {draft.archived ? 'Unarchive' : 'Archive'}
                  </Button>
                  <Button
                    icon="trash"
                    variant="danger"
                    onClick={() => {
                      const p = patients.find((x) => x.id === draft.id) ?? null;
                      setDraft(null);
                      setTyped('');
                      setDeleting(p);
                    }}
                    data-testid="delete-patient"
                  >
                    Delete
                  </Button>
                </>
              )}
              <Button icon="close" variant="quiet" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="stack">
            <Field label="ID code" help="Use an ID code, not a name.">
              <input
                className="input"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                autoCapitalize="characters"
                autoCorrect="off"
                data-testid="patient-code-input"
              />
            </Field>
            <Field label="Date added">
              <input
                className="input"
                type="date"
                value={draft.dateAdded}
                onChange={(e) => setDraft({ ...draft, dateAdded: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                data-testid="patient-notes-input"
              />
            </Field>
            {draft.archived && <div className="notice warn">This patient is archived.</div>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Delete patient and all sessions?"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button
                icon="trash"
                variant="danger"
                disabled={typed.trim() !== deleting.code}
                onClick={() => void confirmDelete()}
                data-testid="confirm-delete"
              >
                Delete permanently
              </Button>
              <Button icon="close" variant="quiet" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>
              This permanently deletes {deleting.code} and every saved session for them. It cannot be undone. To
              confirm, type the ID code <strong>{deleting.code}</strong>.
            </p>
            <input
              className="input"
              aria-label="Type the ID code to confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              data-testid="confirm-delete-input"
            />
          </div>
        </Modal>
      )}
    </Screen>
  );
}
