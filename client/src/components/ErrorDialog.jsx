import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

export default function ErrorDialog({ deck, form, setForm, onClose, onSave }) {
  return (
    <div className="dialog-backdrop" style={{ zIndex: 60, alignItems: 'flex-start', paddingTop: '8vh' }}>
      <div className="dialog" style={{ width: 'min(520px, 100%)' }}>
        <div>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>ERROR LOG ENTRY</div>
          <div className="dialog-title" style={{ marginTop: 5 }}>
            What was the reason — not the question number.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {deck.examCourses.map((c) => (
            <button
              key={c.id}
              onClick={() => setForm({ ...form, courseId: c.id })}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                ...mono(11),
                letterSpacing: '.07em',
                padding: '5px 9px',
                background: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-divider)',
                whiteSpace: 'nowrap',
              }}
            >
              {form.courseId === c.id ? (
                <span style={{ color: 'var(--color-accent)' }}>▍{c.code}</span>
              ) : (
                <span style={{ opacity: 0.55 }}>{c.code}</span>
              )}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Topic</label>
          <input
            className="input"
            style={{ fontSize: 13 }}
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Mode shapes · G-code interpolation · Shape functions"
          />
        </div>
        <div className="field">
          <label>What I got wrong (two lines, the reason)</label>
          <textarea
            className="input"
            style={{ fontSize: 13.5, minHeight: 66 }}
            value={form.what}
            onChange={(e) => setForm({ ...form, what: e.target.value })}
            placeholder="Forgot to normalise the mode shape before computing modal mass."
          />
        </div>

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5 }}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} style={{ fontSize: 12.5 }}>Bank it</button>
        </div>
      </div>
    </div>
  );
}
