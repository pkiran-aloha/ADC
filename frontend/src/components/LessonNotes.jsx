import { useMemo, useState } from 'react';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { AbcEntryDialog, NewLessonNoteDialog, SignatureDialog } from './Modals/LessonNoteModals';
import { isLessonNoteEditable, TARGET_TYPE_LABELS } from '../utils/programManagement';
import { ArrowLeft, Notebook, Plus } from './ui/Icons';

// Lesson notes: one dated run of a lesson. The list is the record of sessions run; the
// open note shows what was planned, what has been recorded, and who has signed.
export default function LessonNotes({
  notes = [], lessons = [], programs = [], observations = [], abcEntries = [], abcConfiguration = null,
  canEdit = true, asOf, onCreate, onUpdate, onStatus, onSign, onRecord, onRecordAbc
}) {
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const note = notes.find(item => item.id === openId) || null;

  if (note) {
    return <NoteView note={note} lessons={lessons} programs={programs} observations={observations} abcEntries={abcEntries}
      abcConfiguration={abcConfiguration} canEdit={canEdit} onBack={() => setOpenId(null)}
      onUpdate={onUpdate} onStatus={onStatus} onSign={onSign} onRecord={onRecord} onRecordAbc={onRecordAbc} />;
  }

  const countFor = id => observations.filter(row => row.lessonNoteId === id).length + abcEntries.filter(entry => entry.lessonNoteId === id).length;
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  return <>
    <div className="programs-listing-header">
      <p className="programs-listing-count">{notes.length} lesson {notes.length === 1 ? 'note' : 'notes'}</p>
      {canEdit && <button type="button" className="button button--primary" onClick={() => setCreating(true)}><Plus size={16} />New lesson note</button>}
    </div>
    {sorted.length === 0
      ? <EmptyState title="No lesson notes yet." icon={Notebook}
        description="A lesson note is one dated run of a lesson. Create one to record data against what was planned." />
      : <table className="programs-table">
        <caption className="sr-only">Lesson notes, newest first</caption>
        <thead><tr>
          <th scope="col">Lesson note</th><th scope="col">Date</th><th scope="col">Lesson</th>
          <th scope="col">Status</th><th scope="col">Recorded</th><th scope="col">Signatures</th>
        </tr></thead>
        <tbody>
          {sorted.map(item => <tr key={item.id}>
            <th scope="row"><button type="button" className="programs-table-name" onClick={() => setOpenId(item.id)}>{item.title}</button></th>
            <td>{item.date}</td>
            <td>{lessons.find(lesson => lesson.id === item.lessonId)?.name || '–'}</td>
            <td><span className={`status-pill status-pill--${item.status.toLowerCase()}`}>{item.status}</span></td>
            <td>{countFor(item.id)}</td>
            <td>{item.signatures.length}</td>
          </tr>)}
        </tbody>
      </table>}
    {creating && <NewLessonNoteDialog isOpen lessons={lessons} asOf={asOf} onClose={() => setCreating(false)}
      onSave={values => { const created = onCreate?.(values); setCreating(false); if (created) setOpenId(created.id); }} />}
  </>;
}

function NoteView({ note, lessons, programs, observations, abcEntries, abcConfiguration, canEdit, onBack, onUpdate, onStatus, onSign, onRecord, onRecordAbc }) {
  const [title, setTitle] = useState(note.title);
  const [date, setDate] = useState(note.date);
  const [signing, setSigning] = useState(false);
  const [recordingAbc, setRecordingAbc] = useState(false);
  const [approving, setApproving] = useState(false);
  const editable = canEdit && isLessonNoteEditable(note);
  const lesson = lessons.find(item => item.id === note.lessonId);
  const planned = useMemo(() => note.programIds
    .map(id => programs.find(program => program.id === id)).filter(Boolean)
    .map(program => ({ program, targets: (program.targets || []).filter(target => note.targetIds.includes(target.id)) })), [note, programs]);
  const rows = observations.filter(row => row.lessonNoteId === note.id);
  const entries = abcEntries.filter(entry => entry.lessonNoteId === note.id);
  const dirty = title.trim() !== note.title || date !== note.date;

  return <section className="program-view" aria-labelledby="note-title">
    <button type="button" className="button button--tertiary" onClick={onBack}><ArrowLeft size={16} />Back to lesson notes</button>
    <header className="program-view-header">
      <div>
        <h2 id="note-title">{note.title}</h2>
        <p className="program-view-meta">
          <span className={`status-pill status-pill--${note.status.toLowerCase()}`}>{note.status}</span>
          <span className="status-label">{note.date}</span>
          <span className="status-label">{lesson?.name || 'Lesson removed'}</span>
        </p>
      </div>
      {editable && <div className="program-view-actions">
        {note.status === 'Draft' && <button type="button" className="button button--secondary" onClick={() => onStatus?.(note, 'Unapproved')}>Submit for review</button>}
        {note.status === 'Unapproved' && <>
          <button type="button" className="button button--secondary" onClick={() => onStatus?.(note, 'Draft')}>Return to draft</button>
          <button type="button" className="button button--primary" onClick={() => setApproving(true)}>Approve</button>
        </>}
      </div>}
    </header>

    {!isLessonNoteEditable(note) && <p className="programs-readonly-note" role="status">
      This lesson note is approved. Its details, its signatures and the data recorded into it are locked.
    </p>}

    {editable && <section className="abc-context" aria-label="Lesson note details">
      <label htmlFor="note-edit-title">Title</label>
      <input id="note-edit-title" type="text" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} />
      <label htmlFor="note-edit-date">Date</label>
      <input id="note-edit-date" type="date" value={date} onChange={event => setDate(event.target.value)} />
      <button type="button" className="button button--secondary" disabled={!dirty || !title.trim()}
        onClick={() => onUpdate?.(note, { title, date })}>Save details</button>
    </section>}

    <section aria-labelledby="note-plan-title" className="lessons-panel">
      <header className="abc-list-header">
        <h3 id="note-plan-title">Planned</h3>
        {editable && <div className="program-view-actions">
          <button type="button" className="button button--primary" disabled={!planned.some(item => item.targets.length)} onClick={() => onRecord?.(note)}>Record data</button>
          <button type="button" className="button button--secondary" onClick={() => setRecordingAbc(true)}>Record ABC observation</button>
        </div>}
      </header>
      {planned.length === 0
        ? <p className="program-form-note">This note plans no programs. Its lesson held no active programs when the note was made.</p>
        : planned.map(({ program, targets }) => <div key={program.id}>
          <strong>{program.name}</strong>
          <ul>{targets.map(target => <li key={target.id}>{target.name} <span className="status-label">{TARGET_TYPE_LABELS[target.type]}</span></li>)}</ul>
        </div>)}
    </section>

    <section aria-labelledby="note-data-title" className="lessons-panel">
      <h3 id="note-data-title">Recorded in this note</h3>
      <p className="program-form-note">{rows.length} observation{rows.length === 1 ? '' : 's'} and {entries.length} ABC observation{entries.length === 1 ? '' : 's'}. They are saved in this browser and appear in the analytics.</p>
    </section>

    <section aria-labelledby="note-sign-title" className="lessons-panel">
      <header className="abc-list-header">
        <h3 id="note-sign-title">Signatures</h3>
        {editable && <button type="button" className="button button--secondary" onClick={() => setSigning(true)}>Sign</button>}
      </header>
      {note.signatures.length === 0
        ? <p className="program-form-note">No one has signed this lesson note yet.</p>
        : <ul>{note.signatures.map((signature, index) => <li key={index}>{signature.signedBy} · {signature.role} · {signature.signedOn}</li>)}</ul>}
    </section>

    {signing && <SignatureDialog isOpen onClose={() => setSigning(false)} onSave={values => { onSign?.(note, values); setSigning(false); }} />}
    {recordingAbc && <AbcEntryDialog isOpen configuration={abcConfiguration} onClose={() => setRecordingAbc(false)}
      onSave={values => { onRecordAbc?.(note, values); setRecordingAbc(false); }} />}
    <ConfirmDialog isOpen={approving} onClose={() => setApproving(false)} title={`Approve “${note.title}”?`}
      description="An approved lesson note is a finished record. Its details, signatures and recorded data can no longer change."
      confirmLabel="Approve lesson note" onConfirm={() => { onStatus?.(note, 'Approved'); setApproving(false); }} />
  </section>;
}

