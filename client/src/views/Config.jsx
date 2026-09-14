import React, { useState } from 'react';
import CommitInput from '../components/CommitInput.jsx';
import ScheduleEditor from '../components/ScheduleEditor.jsx';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

const CONFIDENCE_COLOR = {
  high: 'rgba(238,243,248,.45)',
  medium: 'var(--color-accent)',
  low: 'var(--sig)',
};

export default function Config({ deck, actions, onAskReset }) {
  const { courses } = deck;
  const [add, setAdd] = useState({
    courseId: 'me597',
    kind: 'work',
    title: '',
    weight: '',
    estHours: '',
    dueDate: '',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Config</h6>
        <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
          weights, estimates and dates. Weights are confirmed from the outlines; every date starts empty and is
          filled in by a scan you confirm.
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ width: 78 }}>Course</th>
              <th>Item</th>
              <th style={{ width: 74 }}>Weight %</th>
              <th style={{ width: 74 }}>Est. h</th>
              <th style={{ width: 152 }}>Due</th>
              <th style={{ width: 96 }}>Source</th>
              <th style={{ width: 96 }}>Status</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {deck.configRows.map((cr) => (
              <tr key={cr.id}>
                <td style={{ ...mono(11), color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>{cr.course}</td>
                <td style={{ fontSize: 13 }}>
                  {cr.title}
                  {cr.isExam && (
                    <span style={{ ...mono(9.5), letterSpacing: '.1em', color: 'rgba(238,243,248,.45)', marginLeft: 6 }}>
                      EXAM
                    </span>
                  )}
                </td>
                <td>
                  <CommitInput
                    className="input"
                    value={String(cr.weight)}
                    onCommit={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n) && n !== cr.weight) actions.patchTask(cr.id, { weight: n });
                    }}
                    style={{ ...mono(12), minHeight: 30, padding: '3px 6px' }}
                  />
                </td>
                <td>
                  <CommitInput
                    className="input"
                    value={String(cr.estHours)}
                    onCommit={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n) && n > 0 && n !== cr.estHours) actions.patchTask(cr.id, { estHours: n });
                    }}
                    style={{ ...mono(12), minHeight: 30, padding: '3px 6px' }}
                  />
                </td>
                <td>
                  <CommitInput
                    className="input"
                    type="date"
                    value={cr.dueDate || ''}
                    // Long enough that stepping through months in the picker
                    // never lands a half-finished date on the server.
                    quietMs={1200}
                    onCommit={(v) => actions.patchTask(cr.id, { dueDate: v || null })}
                    style={{ ...mono(11.5), minHeight: 30, padding: '3px 6px' }}
                  />
                </td>
                <td>
                  {cr.dueDate ? (
                    <span
                      style={{ ...mono(10), letterSpacing: '.08em', color: CONFIDENCE_COLOR[cr.confidence] }}
                      title={cr.sourceFile || 'entered by hand'}
                    >
                      {cr.userConfirmed ? 'CONFIRMED' : `${cr.confidence.toUpperCase()} · UNCONFIRMED`}
                    </span>
                  ) : (
                    <span style={mono(10, { color: 'rgba(238,243,248,.3)', letterSpacing: '.08em' })}>NO DATE</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => actions.setStatus(cr.id, cr.status === 'done' ? 'todo' : 'done')}
                    style={{ fontSize: 10.5, padding: '3px 7px', letterSpacing: '.06em', whiteSpace: 'nowrap' }}
                  >
                    {cr.status === 'done' ? 'SUBMITTED' : 'OPEN'}
                  </button>
                </td>
                <td>
                  <button
                    className="btn btn-ghost"
                    onClick={() => actions.deleteTask(cr.id)}
                    style={{ fontSize: 11, padding: '0 4px', color: 'var(--sig)' }}
                  >
                    del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── add an item ───────────────────────────────────────────────────── */}
      <div className="blueprint" style={{ padding: '16px 18px' }}>
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>ADD AN ITEM</div>
        <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.55)', marginTop: 4 }}>
          Use this for ME 597 once Melek posts the breakdown, and for any LEARN date not yet in the deck. Anything
          typed here counts as confirmed.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 120px' }}>
            <label>Course</label>
            <select
              className="input"
              style={{ fontSize: 12.5 }}
              value={add.courseId}
              onChange={(e) => setAdd({ ...add, courseId: e.target.value })}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label>Title</label>
            <input
              className="input"
              style={{ fontSize: 12.5 }}
              value={add.title}
              onChange={(e) => setAdd({ ...add, title: e.target.value })}
              placeholder="Midterm / Assignment 1 / Quiz 3"
            />
          </div>
          <div className="field" style={{ flex: '0 0 92px' }}>
            <label>Weight %</label>
            <input
              className="input"
              style={mono(12.5)}
              value={add.weight}
              onChange={(e) => setAdd({ ...add, weight: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: '0 0 82px' }}>
            <label>Est. h</label>
            <input
              className="input"
              style={mono(12.5)}
              value={add.estHours}
              onChange={(e) => setAdd({ ...add, estHours: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: '0 0 150px' }}>
            <label>Due</label>
            <input
              className="input"
              type="date"
              style={mono(12)}
              value={add.dueDate}
              onChange={(e) => setAdd({ ...add, dueDate: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: '0 0 104px' }}>
            <label>Kind</label>
            <select
              className="input"
              style={{ fontSize: 12.5 }}
              value={add.kind}
              onChange={(e) => setAdd({ ...add, kind: e.target.value })}
            >
              <option value="work">Deliverable</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={!add.title.trim()}
            onClick={async () => {
              await actions.addTask({
                courseId: add.courseId,
                kind: add.kind,
                title: add.title.trim(),
                weight: Number(add.weight) || 0,
                estHours: Number(add.estHours) || 1,
                dueDate: add.dueDate || null,
              });
              setAdd({ ...add, title: '', weight: '', estHours: '', dueDate: '' });
            }}
            style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
          >
            Add to deck
          </button>
        </div>
      </div>

      <ScheduleEditor deck={deck} actions={actions} />

      {/* ── courses + danger zone ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h6 style={{ color: 'var(--color-accent)' }}>Courses &amp; escalation contacts</h6>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {courses.map((c) => (
              <div key={c.id} style={{ borderTop: '1px solid rgba(238,243,248,.11)', padding: '10px 0' }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ ...mono(11.5), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                    {c.code}
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>{c.title}</span>
                  <span style={{ fontSize: 12, color: 'rgba(238,243,248,.45)' }}>{c.instructor}</span>
                </div>
                <div style={{ ...mono(11), color: 'rgba(238,243,248,.45)', marginTop: 3 }}>{c.meets}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.7)', marginTop: 3 }}>
                  Escalate to: {c.contact}
                </div>
                <div style={{ ...mono(10.5), color: 'rgba(238,243,248,.35)', marginTop: 3 }}>
                  {c.folderPath || 'folder not matched yet — run a scan'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 260px', maxWidth: 360, minWidth: 0 }}>
          <h6 style={{ color: 'var(--sig)' }}>Danger zone</h6>
          <div className="card" style={{ padding: '14px 15px', gap: 8, borderColor: 'rgba(226,145,63,.4)' }}>
            <div style={{ fontSize: 13, color: 'rgba(238,243,248,.7)' }}>
              Wipes tasks, error log, concepts, sessions and settings, then reloads the seeded term. Your course
              files are never touched. The scanner's hash ledger is kept.
            </div>
            <button
              className="btn btn-secondary"
              onClick={onAskReset}
              style={{ fontSize: 12, color: 'var(--sig)', borderColor: 'rgba(226,145,63,.45)', whiteSpace: 'nowrap' }}
            >
              Reset deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
