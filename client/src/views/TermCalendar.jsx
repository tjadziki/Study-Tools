import React, { useMemo, useState } from 'react';
import { d, fmtShort } from '../lib/dates.js';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

const dayName = (iso) => (iso ? d(iso).toLocaleDateString('en-CA', { weekday: 'short' }) : '');

export default function TermCalendar({ deck, actions }) {
  const confirmed = deck.settings.termCalendarConfirmed === 'true';
  const [weeks, setWeeks] = useState(() =>
    deck.termWeeks.map((w) => ({ ...w, isReadingWeek: !!w.isReadingWeek }))
  );
  const [dirty, setDirty] = useState(false);

  // Evidence the scanner found in the course files. Offered, never applied.
  const evidence = useMemo(() => {
    try {
      return deck.settings.readingWeekEvidence ? JSON.parse(deck.settings.readingWeekEvidence) : null;
    } catch {
      return null;
    }
  }, [deck.settings.readingWeekEvidence]);

  const current = weeks.find((w) => w.isReadingWeek);
  const evidenceDiffers =
    evidence && current && (current.startDate !== evidence.startDate || current.endDate !== evidence.endDate);

  const patch = (i, key, value) => {
    setWeeks((ws) => ws.map((w, j) => (j === i ? { ...w, [key]: value } : w)));
    setDirty(true);
  };

  /** Gaps and overlaps between consecutive weeks — the usual way this goes wrong. */
  const problems = useMemo(() => {
    const out = [];
    const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < sorted.length; i++) {
      const w = sorted[i];
      if (w.endDate < w.startDate) out.push(`${label(w)} ends before it starts.`);
      const next = sorted[i + 1];
      if (!next) continue;
      const dayAfter = new Date(`${w.endDate}T12:00:00`);
      dayAfter.setDate(dayAfter.getDate() + 1);
      const expected = dayAfter.toISOString().slice(0, 10);
      if (next.startDate < expected) out.push(`${label(w)} overlaps ${label(next)}.`);
      else if (next.startDate > expected) out.push(`Gap between ${label(w)} and ${label(next)}.`);
    }
    return out;
  }, [weeks]);

  /**
   * Apply the scanner's reading-week evidence.
   *
   * Moving reading week alone would leave the weeks on either side overlapping
   * it, so the neighbours are trimmed to butt up against the new span. Only
   * the immediate neighbours move; the rest of the numbering is untouched.
   */
  const applyEvidence = () => {
    if (!evidence) return;
    setWeeks((ws) => {
      const sorted = [...ws].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const i = sorted.findIndex((w) => w.isReadingWeek);
      if (i === -1) return ws;

      const next = sorted.map((w, j) => {
        if (j === i) return { ...w, startDate: evidence.startDate, endDate: evidence.endDate };
        if (j === i - 1) return { ...w, endDate: addDays(evidence.startDate, -1) };
        if (j === i + 1) return { ...w, startDate: addDays(evidence.endDate, 1) };
        return w;
      });
      return next;
    });
    setDirty(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Term calendar</h6>
        <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
          week numbers to date ranges · every week-relative deadline resolves against this
        </span>
      </div>

      {!confirmed && (
        <div
          className="blueprint"
          style={{ padding: '14px 16px', borderColor: 'rgba(226,145,63,.5)', background: 'rgba(226,145,63,.06)' }}
        >
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>NOT CONFIRMED</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
            This calendar is a <strong>best guess</strong>. Lectures are known to run Sep 9 – Dec 8, but reading week
            shifts the numbering and its dates were not verified. Until you confirm this screen, any date written as
            “Friday of Week 5” stays at <strong>low</strong> confidence and will not be trusted.
          </div>
        </div>
      )}

      {evidence && (
        <div className="card" style={{ padding: '13px 15px', gap: 7 }}>
          <div className="card-kicker" style={{ color: 'var(--color-accent)' }}>Found in your course files</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            A scanned document states reading week runs{' '}
            <span style={{ ...mono(12.5), color: 'var(--sig)' }}>
              {fmtShort(evidence.startDate)} – {fmtShort(evidence.endDate)}
            </span>
            {evidenceDiffers ? (
              <>
                , which differs from the {current ? `${fmtShort(current.startDate)} – ${fmtShort(current.endDate)}` : 'current'} guess below.
              </>
            ) : (
              <> — matching what is set below.</>
            )}
          </div>
          <div style={{ ...mono(10), color: 'rgba(238,243,248,.35)' }}>
            {String(evidence.sourceFile).split(/[\\/]/).pop()}
          </div>
          {evidenceDiffers && (
            <button className="btn btn-secondary" onClick={applyEvidence} style={{ fontSize: 11.5, alignSelf: 'flex-start' }}>
              Use the scanned dates
            </button>
          )}
        </div>
      )}

      {problems.length > 0 && (
        <div className="card" style={{ padding: '12px 14px', gap: 4, borderColor: 'rgba(226,145,63,.4)' }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>CHECK THESE</div>
          {problems.slice(0, 6).map((p, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'rgba(238,243,248,.75)' }}>{p}</div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: 96 }}>Week</th>
              <th style={{ width: 170 }}>Starts</th>
              <th style={{ width: 170 }}>Ends</th>
              <th style={{ width: 110 }}>Reading week</th>
              <th>Span</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={`${w.weekNumber}-${i}`} style={w.isReadingWeek ? { background: 'rgba(226,145,63,.07)' } : undefined}>
                <td style={{ ...mono(12), color: w.isReadingWeek ? 'var(--sig)' : 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                  {label(w)}
                </td>
                <td>
                  <input
                    className="input"
                    type="date"
                    value={w.startDate}
                    onChange={(e) => patch(i, 'startDate', e.target.value)}
                    style={{ ...mono(11.5), minHeight: 30, padding: '3px 6px' }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="date"
                    value={w.endDate}
                    onChange={(e) => patch(i, 'endDate', e.target.value)}
                    style={{ ...mono(11.5), minHeight: 30, padding: '3px 6px' }}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => patch(i, 'isReadingWeek', !w.isReadingWeek)}
                    style={{ fontSize: 10.5, padding: '3px 7px', letterSpacing: '.06em' }}
                  >
                    {w.isReadingWeek ? 'YES' : 'no'}
                  </button>
                </td>
                <td style={{ ...mono(11), color: 'rgba(238,243,248,.5)' }}>
                  {dayName(w.startDate)} → {dayName(w.endDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await actions.saveTermWeeks(weeks, true);
            setDirty(false);
          }}
          style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
        >
          {confirmed && !dirty ? 'Re-confirm calendar' : 'Save & confirm calendar'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await actions.saveTermWeeks(weeks, false);
            setDirty(false);
          }}
          style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
        >
          Save without confirming
        </button>
        <span style={{ ...mono(11), color: confirmed ? '#8fce9a' : 'var(--sig)', letterSpacing: '.08em' }}>
          {confirmed ? 'CONFIRMED — week-relative dates are trusted' : 'UNCONFIRMED — week-relative dates stay low confidence'}
        </span>
        {dirty && <span style={{ ...mono(11), color: 'var(--sig)' }}>unsaved changes</span>}
      </div>

      <div style={{ fontSize: 11.5, color: 'rgba(238,243,248,.4)', maxWidth: 640, lineHeight: 1.5 }}>
        Reading week is stored outside the lecture numbering, so “Week 6” means the week after it. Re-run a scan
        after confirming to re-resolve any week-relative dates at their new confidence.
      </div>
    </div>
  );
}

function label(w) {
  return w.isReadingWeek ? 'READING' : `Week ${String(w.weekNumber).padStart(2, '0')}`;
}

function addDays(iso, n) {
  const dt = new Date(`${iso}T12:00:00`);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
