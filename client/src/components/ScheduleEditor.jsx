import React, { useEffect, useMemo, useState } from 'react';
import { hhmm } from '../lib/plan.js';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const dim = 'rgba(238,243,248,.45)';

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
  { n: 0, label: 'Sun' },
];

const toMin = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * The timetable and the study window — the two things the daily plan is cut
 * from. Edits are local until Save, because the timetable is written as a
 * whole and a half-finished row would hand the planner an hour that does not
 * exist.
 */
export default function ScheduleEditor({ deck, actions }) {
  const { courses, settings } = deck;
  const week = deck.today ? deck.weekPlan : null;
  const blocks = useMemo(
    () =>
      (deck.classBlocks || [])
        .slice()
        .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin),
    [deck.classBlocks]
  );

  const [draft, setDraft] = useState(blocks);
  const [dirty, setDirty] = useState(false);

  // Adopt server rows only while there is nothing unsaved to lose.
  useEffect(() => {
    if (!dirty) setDraft(blocks);
  }, [blocks, dirty]);

  const edit = (i, patch) => {
    setDirty(true);
    setDraft((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const remove = (i) => {
    setDirty(true);
    setDraft((rows) => rows.filter((_, j) => j !== i));
  };
  const add = () => {
    setDirty(true);
    setDraft((rows) => [
      ...rows,
      {
        id: `new-${Date.now().toString(36)}`,
        courseId: courses[0]?.id,
        weekday: 1,
        startMin: 600,
        endMin: 680,
        kind: 'LEC',
        label: '',
      },
    ]);
  };

  const broken = draft.filter((b) => !(b.endMin > b.startMin));

  const num = (key, fallback) => {
    const v = Number(settings[key]);
    return Number.isFinite(v) ? v : fallback;
  };

  const setTime = (key) => (e) => {
    const m = toMin(e.target.value);
    if (m != null) actions.settings({ [key]: String(m) });
  };
  const setNum = (key) => (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v > 0) actions.settings({ [key]: String(v) });
  };

  const weeklyCapacity = week ? week.reduce((a, day) => a + day.capacityMin, 0) : 0;
  const weeklyTarget = week ? week.reduce((a, day) => a + day.targetMin, 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
          Study window &amp; timetable
        </h6>
        <span style={{ fontSize: 12, color: dim }}>
          the daily plan is this window minus these classes — change either and Today rebuilds
        </span>
      </div>

      {/* ── the window ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '0 0 122px' }}>
          <label>Start the day</label>
          <input
            className="input"
            type="time"
            style={mono(12.5)}
            defaultValue={hhmm(num('dayStartMin', 450))}
            key={`start-${settings.dayStartMin}`}
            onBlur={setTime('dayStartMin')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 122px' }}>
          <label>Hard stop</label>
          <input
            className="input"
            type="time"
            style={mono(12.5)}
            defaultValue={hhmm(num('dayEndMin', 1260))}
            key={`end-${settings.dayEndMin}`}
            onBlur={setTime('dayEndMin')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 96px' }}>
          <label>Target h/day</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('dailyTargetHours', 4)}
            key={`dt-${settings.dailyTargetHours}`}
            onBlur={setNum('dailyTargetHours')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 106px' }}>
          <label>Target h/weekend day</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('weekendTargetHours', 4)}
            key={`wt-${settings.weekendTargetHours}`}
            onBlur={setNum('weekendTargetHours')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 88px' }}>
          <label>Block min</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('minBlockMinutes', 45)}
            key={`bmin-${settings.minBlockMinutes}`}
            onBlur={setNum('minBlockMinutes')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 88px' }}>
          <label>Block max</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('maxBlockMinutes', 110)}
            key={`bmax-${settings.maxBlockMinutes}`}
            onBlur={setNum('maxBlockMinutes')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 78px' }}>
          <label>Break</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('breakMinutes', 15)}
            key={`brk-${settings.breakMinutes}`}
            onBlur={setNum('breakMinutes')}
          />
        </div>
        <div className="field" style={{ flex: '0 0 88px' }}>
          <label>Class buffer</label>
          <input
            className="input"
            style={mono(12.5)}
            defaultValue={num('classBufferMinutes', 15)}
            key={`buf-${settings.classBufferMinutes}`}
            onBlur={setNum('classBufferMinutes')}
          />
        </div>
      </div>

      {week && (
        <div style={{ ...mono(11), color: dim }}>
          That leaves {(weeklyCapacity / 60).toFixed(1)} h free across the next seven days against a target of{' '}
          {(weeklyTarget / 60).toFixed(0)} h.
        </div>
      )}

      {/* ── the timetable ────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ width: 96 }}>Course</th>
              <th style={{ width: 84 }}>Day</th>
              <th style={{ width: 116 }}>Start</th>
              <th style={{ width: 116 }}>End</th>
              <th style={{ width: 86 }}>Kind</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {draft.map((b, i) => (
              <tr key={b.id}>
                <td>
                  <select
                    className="input"
                    style={{ fontSize: 12.5, minHeight: 30, padding: '3px 6px' }}
                    value={b.courseId}
                    onChange={(e) => edit(i, { courseId: e.target.value })}
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="input"
                    style={{ fontSize: 12.5, minHeight: 30, padding: '3px 6px' }}
                    value={b.weekday}
                    onChange={(e) => edit(i, { weekday: Number(e.target.value) })}
                  >
                    {DAYS.map((d) => (
                      <option key={d.n} value={d.n}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    type="time"
                    style={{ ...mono(12), minHeight: 30, padding: '3px 6px' }}
                    value={hhmm(b.startMin)}
                    onChange={(e) => {
                      const m = toMin(e.target.value);
                      if (m != null) edit(i, { startMin: m });
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="time"
                    style={{
                      ...mono(12),
                      minHeight: 30,
                      padding: '3px 6px',
                      borderColor: b.endMin > b.startMin ? undefined : 'var(--sig)',
                    }}
                    value={hhmm(b.endMin)}
                    onChange={(e) => {
                      const m = toMin(e.target.value);
                      if (m != null) edit(i, { endMin: m });
                    }}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    style={{ fontSize: 12.5, minHeight: 30, padding: '3px 6px' }}
                    value={b.kind}
                    onChange={(e) => edit(i, { kind: e.target.value })}
                  >
                    <option value="LEC">LEC</option>
                    <option value="LAB">LAB</option>
                    <option value="TUT">TUT</option>
                    <option value="PRJ">PRJ</option>
                  </select>
                </td>
                <td>
                  <button
                    className="btn btn-ghost"
                    onClick={() => remove(i)}
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

      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={add} style={{ fontSize: 12.5 }}>
          Add a class
        </button>
        <button
          className="btn btn-primary"
          disabled={!dirty || broken.length > 0}
          onClick={async () => {
            await actions.saveClassBlocks(draft);
            setDirty(false);
          }}
          style={{ fontSize: 12.5 }}
        >
          Save timetable
        </button>
        {dirty && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setDraft(blocks);
              setDirty(false);
            }}
            style={{ fontSize: 12.5 }}
          >
            Discard
          </button>
        )}
        <span style={{ ...mono(11), color: broken.length ? 'var(--sig)' : dim }}>
          {broken.length
            ? `${broken.length} class ends before it starts`
            : dirty
              ? 'unsaved — Today still shows the old timetable'
              : 'saved'}
        </span>
      </div>
    </div>
  );
}
