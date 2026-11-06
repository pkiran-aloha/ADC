import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Field } from '../ui/Field';

const NEW_LESSON = '__new__';

// Add programs to a lesson: choose one that already exists, or start a new one. A
// lesson is a reusable group of one client's programs, defined once and used each
// time that session runs.
export default function LessonDialog({ isOpen, onClose, onSave, lessons = [], programs = [], title = 'Add to lesson' }) {
  const [choice, setChoice] = useState(lessons[0]?.id || NEW_LESSON);
  const [name, setName] = useState('');
  const [attempted, setAttempted] = useState(false);
  const creating = choice === NEW_LESSON;
  const nameError = creating && attempted && !name.trim() ? 'Give the lesson a name.' : undefined;

  function submit(event) {
    event.preventDefault();
    setAttempted(true);
    if (creating && !name.trim()) return;
    onSave?.({ lessonId: creating ? null : choice, name: name.trim(), programIds: programs.map(program => program.id) });
  }

  return <Dialog isOpen={isOpen} onClose={onClose} title={title}
    description={`${programs.length} program${programs.length === 1 ? '' : 's'} selected.`}>
    <form className="program-form" noValidate onSubmit={submit}>
      {programs.length > 0 && <ul className="lesson-dialog-programs" aria-label="Selected programs">
        {programs.map(program => <li key={program.id}>{program.name}</li>)}
      </ul>}
      <Field id="lesson-choice" label="Lesson" hint="Choose an existing lesson, or create a new one.">
        <select value={choice} onChange={event => setChoice(event.target.value)}>
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}
          <option value={NEW_LESSON}>New lesson…</option>
        </select>
      </Field>
      {creating && <Field id="lesson-name" label="Lesson name" required error={nameError}>
        <input type="text" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
      </Field>}
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">{creating ? 'Create lesson' : 'Add to lesson'}</button>
      </div>
    </form>
  </Dialog>;
}
