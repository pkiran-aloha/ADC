import { useMemo, useState } from 'react';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { AbcEntryDialog, AddToNoteDialog, NewLessonNoteDialog, SignatureDialog } from './Modals/LessonNoteModals';
import { isLessonNoteEditable, TARGET_TYPE_LABELS } from '../utils/programManagement';
import { ArrowLeft, Notebook, Plus, Trash2 } from './ui/Icons';

// Lesson notes: one dated run of a lesson. The list is the record of sessions run; the
// open note shows what was planned, what has been recorded, and who has signed.
export default function LessonNotes({
  notes = [], lessons = [], programs = [], observations = [], abcEntries = [], abcConfiguration = null,
  canEdit = true, asOf, onCreate, onUpdate, onStatus, onSign, onRecord, onRecordAbc, onAddTargets, onRemoveAbc
}) {
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const note = notes.find(item => item.id === openId) || null;

  if (note) {
    return <NoteView note={note} lessons={lessons} programs={programs} observations={observations} abcEntries={abcEntries}
      abcConfiguration={abcConfiguration} canEdit={canEdit} onBack={() => setOpenId(null)}
      onUpdate={onUpdate} onStatus={onStatus} onSign={onSign} onRecord={onRecord} onRecordAbc={onRecordAbc}
      onAddTargets={onAddTargets} onRemoveAbc={onRemoveAbc} />;
  }

  const countFor = id => observations.filter(row => row.lessonNoteId === id).length + abcEntries.filter(entry => entry.lessonNoteId === id).length;
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  return <>
    <div className="pm-listing-head">
      <p className="pm-count"><strong>{notes.length}</strong> lesson {notes.length === 1 ? 'note' : 'notes'}</p>
      {canEdit && <button type="button" className="button button--primary" onClick={() => setCreating(true)}><Plus size={16} />New lesson note</button>}
    </div>
    {sorted.length === 0
      ? <EmptyState title="No lesson notes yet." icon={Notebook}
        description="A lesson note is one dated run of a lesson. Create one to record data against what was planned." />
      : <div className="pm-table-wrap"><table className="pm-table">
        <caption className="sr-only">Lesson notes, newest first</caption>
        <thead><tr>
          <th scope="col">Lesson note</th><th scope="col">Date</th><th scope="col">Lesson</th>
          <th scope="col">Status</th><th scope="col" className="pm-col-num">Recorded</th><th scope="col" className="pm-col-num">Signatures</th>
        </tr></thead>
        <tbody>
          {sorted.map(item => <tr key={item.id}>
            <th scope="row" className="pm-col-name"><button type="button" className="pm-name-link" onClick={() => setOpenId(item.id)}>{item.title}</button></th>
            <td data-label="Date">{item.date}</td>
            <td data-label="Lesson">{lessons.find(lesson => lesson.id === item.lessonId)?.name || '–'}</td>
            <td data-label="Status"><span className={`pm-status pm-status--${item.status.toLowerCase()}`}>{item.status}</span></td>
            <td className="pm-col-num" data-label="Recorded">{countFor(item.id)}</td>
            <td className="pm-col-num" data-label="Signatures">{item.signatures.length}</td>
          </tr>)}
        </tbody>
      </table></div>}
    {creating && <NewLessonNoteDialog isOpen lessons={lessons} asOf={asOf} onClose={() => setCreating(false)}
      onSave={values => { const created = onCreate?.(values); setCreating(false); if (created) setOpenId(created.id); }} />}
  </>;
}

const formatTime = timestamp => String(timestamp || '').slice(11, 16) || '–';

function NoteView({ note, lessons, programs, observations, abcEntries, abcConfiguration, canEdit, onBack, onUpdate, onStatus, onSign, onRecord, onRecordAbc, onAddTargets, onRemoveAbc }) {
  const [title, setTitle] = useState(note.title);
  const [date, setDate] = useState(note.date);
  const [signing, setSigning] = useState(false);
  const [recordingAbc, setRecordingAbc] = useState(false);
  const [approving, setApproving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [removing, setRemoving] = useState(null);
  const editable = canEdit && isLessonNoteEditable(note);
  const lesson = lessons.find(item => item.id === note.lessonId);
  const planned = useMemo(() => note.programIds
    .map(id => programs.find(program => program.id === id)).filter(Boolean)
    .map(program => ({ program, targets: (program.targets || []).filter(target => note.targetIds.includes(target.id)) })), [note, programs]);
  const rows = observations.filter(row => row.lessonNoteId === note.id);
  const entries = abcEntries.filter(entry => entry.lessonNoteId === note.id)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const dirty = title.trim() !== note.title || date !== note.date;

  return <section className="pm-view" aria-labelledby="note-title">
    <nav className="pm-crumbs" aria-label="Breadcrumb">
      <button type="button" className="pm-crumb-link" onClick={onBack}><ArrowLeft size={15} />Lesson notes</button>
      <span aria-hidden="true">/</span>
      <span>{note.date}</span>
    </nav>
    <header className="pm-view-head">
      <div className="pm-view-title">
        <h2 id="note-title">{note.title}</h2>
        <div className="pm-view-meta">
          <span className={`pm-status pm-status--${note.status.toLowerCase()}`}>{note.status}</span>
          <span className="pm-meta-tag">{note.date}</span>
          <span className="pm-meta-area">{lesson?.name || 'Lesson removed'}</span>
        </div>
      </div>
      {editable && <div className="pm-view-actions">
        {note.status === 'Draft' && <button type="button" className="button button--secondary" onClick={() => onStatus?.(note, 'Unapproved')}>Submit for review</button>}
        {note.status === 'Unapproved' && <>
          <button type="button" className="button button--secondary" onClick={() => onStatus?.(note, 'Draft')}>Return to draft</button>
          <button type="button" className="button button--primary" onClick={() => setApproving(true)}>Approve</button>
        </>}
      </div>}
    </header>

    {!isLessonNoteEditable(note) && <p className="pm-banner" role="status">
      This lesson note is approved. Its details, its signatures and the data recorded into it are locked.
    </p>}

    {editable && <section className="pm-panel" aria-label="Lesson note details">
      <div className="pm-inline-form">
        <div className="field"><label htmlFor="note-edit-title">Title</label>
          <input id="note-edit-title" type="text" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} /></div>
        <div className="field"><label htmlFor="note-edit-date">Date</label>
          <input id="note-edit-date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>
        <button type="button" className="button button--secondary" disabled={!dirty || !title.trim()}
          onClick={() => onUpdate?.(note, { title, date })}>Save details</button>
      </div>
    </section>}

    <section aria-labelledby="note-plan-title" className="pm-panel">
      <header className="pm-panel-head">
        <h3 id="note-plan-title">Planned</h3>
        {editable && <div className="pm-view-actions">
          <button type="button" className="button button--primary" disabled={!planned.some(item => item.targets.length)} onClick={() => onRecord?.(note)}>Record data</button>
          <button type="button" className="button button--secondary" onClick={() => setRecordingAbc(true)}>Record ABC observation</button>
          <button type="button" className="button button--secondary" onClick={() => setPlanning(true)}><Plus size={15} />Add programs and behaviors</button>
        </div>}
      </header>
      {planned.length === 0
        ? <p className="pm-empty-line">This note plans no programs. Its lesson held no active programs when the note was made.</p>
        : <ul className="pm-planned">{planned.map(({ program, targets }) => <li key={program.id}>
          <strong>{program.name}</strong>
          <span className="pm-meta-tag">{program.category === 'BehaviorReduction' ? 'Behavior' : 'Program'}</span>
          <ul>{targets.map(target => <li key={target.id}>{target.name} <span className="pm-tags-inline">{TARGET_TYPE_LABELS[target.type]}</span></li>)}</ul>
        </li>)}</ul>}
    </section>

    <section aria-labelledby="note-data-title" className="pm-panel">
      <h3 id="note-data-title">Recorded in this note</h3>
      <p className="pm-note">{rows.length} observation{rows.length === 1 ? '' : 's'} and {entries.length} ABC observation{entries.length === 1 ? '' : 's'}. They are saved in this browser and appear in the analytics.</p>
      {entries.length > 0 && <div className="pm-table-wrap"><table className="pm-table pm-table--compact">
        <caption className="sr-only">ABC observations in this lesson note</caption>
        <thead><tr><th scope="col">Entry</th><th scope="col">Time</th><th scope="col">Antecedent</th><th scope="col">Behavior</th><th scope="col">Consequence</th><th scope="col">Location</th>
          {editable && <th scope="col"><span className="sr-only">Remove</span></th>}</tr></thead>
        <tbody>{entries.map((entry, index) => <tr key={entry.id}>
          <th scope="row">Entry {index + 1}</th>
          <td data-label="Time">{formatTime(entry.timestamp)}</td>
          <td data-label="Antecedent">{(entry.antecedents || []).join(', ') || <span className="pm-none">None</span>}</td>
          <td data-label="Behavior">{(entry.behaviors || []).join(', ') || <span className="pm-none">None</span>}</td>
          <td data-label="Consequence">{(entry.consequences || []).join(', ') || <span className="pm-none">None</span>}</td>
          <td data-label="Location">{entry.location || <span className="pm-none">None</span>}</td>
          {editable && <td className="pm-col-actions"><button type="button" className="icon-button" aria-label={`Remove entry ${index + 1}`} onClick={() => setRemoving(entry)}><Trash2 size={17} /></button></td>}
        </tr>)}</tbody>
      </table></div>}
    </section>

    <section aria-labelledby="note-sign-title" className="pm-panel">
      <header className="pm-panel-head">
        <h3 id="note-sign-title">Signatures</h3>
        {editable && <button type="button" className="button button--secondary" onClick={() => setSigning(true)}>Sign</button>}
      </header>
      {note.signatures.length === 0
        ? <p className="pm-empty-line">No one has signed this lesson note yet.</p>
        : <ul className="pm-signatures">{note.signatures.map((signature, index) => <li key={index}>{signature.signedBy} · {signature.role} · {signature.signedOn}</li>)}</ul>}
    </section>

    {signing && <SignatureDialog isOpen onClose={() => setSigning(false)} onSave={values => { onSign?.(note, values); setSigning(false); }} />}
    {recordingAbc && <AbcEntryDialog isOpen configuration={abcConfiguration} onClose={() => setRecordingAbc(false)}
      onSave={values => { onRecordAbc?.(note, values); setRecordingAbc(false); }} />}
    {planning && <AddToNoteDialog isOpen programs={programs} planned={note.targetIds} onClose={() => setPlanning(false)}
      onSave={ids => { onAddTargets?.(note, ids); setPlanning(false); }} />}
    <ConfirmDialog isOpen={approving} onClose={() => setApproving(false)} title={`Approve “${note.title}”?`}
      description="An approved lesson note is a finished record. Its details, signatures and recorded data can no longer change."
      confirmLabel="Approve lesson note" onConfirm={() => { onStatus?.(note, 'Approved'); setApproving(false); }} />
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} destructive confirmLabel="Remove"
      title="Remove this ABC observation?" description="It leaves the lesson note and the ABC analytics. The removal is written to the history."
      onConfirm={() => { onRemoveAbc?.(note, removing); setRemoving(null); }} />
  </section>;
}
