import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };
const dim = 'rgba(238,243,248,.45)';

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

// What each kind of block is for, said once, in the legend and on every tag.
const TAG = {
  deliverable: { label: 'DELIVERABLE', color: 'var(--color-accent)' },
  exam: { label: 'EXAM PREP', color: 'var(--sig)' },
  consolidate: { label: 'CONSOLIDATE', color: '#9ad6b4' },
  retrieval: { label: 'RETRIEVAL', color: 'var(--color-accent)' },
  read: { label: 'READ AHEAD', color: '#9ad6b4' },
  unblock: { label: 'UNBLOCK', color: 'var(--sig)' },
  spare: { label: 'SPARE', color: dim },
};

const hoursStr = (min) => `${(min / 60).toFixed(min % 60 ? 1 : 0)} h`;

export default function Today({ deck, actions, now, onGoQueue, onGoConfig }) {
  const day = deck.today;
  const week = deck.weekPlan;
  if (!day) return null;

  const nowMin = (() => {
    const t = new Date(now);
    return t.getHours() * 60 + t.getMinutes();
  })();

  const live = day.slots.find((s) => nowMin >= s.startMin && nowMin < s.endMin);
  const next = day.slots.find((s) => s.startMin > nowMin && !s.done);
  const focus = live || next || day.slots.find((s) => !s.done) || null;
  const inClass = day.classes.find((c) => nowMin >= c.startMin && nowMin < c.endMin);

  // Classes and study blocks on one spine, in the order they actually happen.
  const timeline = [
    ...day.classes.map((c) => ({ ...c, row: 'class', startMin: c.startMin })),
    ...day.slots.map((s) => ({ ...s, row: 'slot' })),
  ].sort((a, b) => a.startMin - b.startMin);

  const donePct = day.targetMin ? Math.min(100, Math.round((day.doneMin / day.targetMin) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── the meter ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Today</h6>
        <span style={{ fontSize: 12.5, color: 'rgba(238,243,248,.55)' }}>
          {new Date(now).toLocaleDateString('en-CA', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}
          {day.classes.length
            ? `${day.classes.length} class${day.classes.length > 1 ? 'es' : ''}`
            : 'no classes'}
          {' · '}
          {hoursStr(day.capacityMin)} of study window free
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={kicker}>LOGGED / TARGET</div>
            <div style={{ ...mono(18), color: day.metTarget ? '#9ad6b4' : 'var(--color-text)' }}>
              {hoursStr(day.doneMin)} <span style={{ color: dim }}>/ {hoursStr(day.targetMin)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 3, background: 'rgba(238,243,248,.12)' }}>
        <div
          style={{
            width: `${donePct}%`,
            height: '100%',
            background: day.metTarget ? '#9ad6b4' : 'var(--color-accent)',
            transition: 'width .2s linear',
          }}
        />
      </div>

      {day.shortOfCapacity && (
        <div style={{ ...mono(11.5), color: 'var(--sig)' }}>
          Classes leave only {hoursStr(day.capacityMin)} inside your study window today — the {hoursStr(day.targetMin)}{' '}
          target cannot be met without borrowing from another day.
        </div>
      )}

      {/* ── right now ──────────────────────────────────────────────────── */}
      {focus && (
        <div
          className="blueprint"
          style={{
            padding: '18px 20px 16px',
            background: live ? 'rgba(226,145,63,.06)' : 'rgba(148,188,227,.05)',
            borderColor: live ? 'rgba(226,145,63,.5)' : 'rgba(148,188,227,.4)',
          }}
        >
          <Corners />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 9 }}>
            <span
              style={{
                ...mono(10),
                letterSpacing: '.14em',
                background: live ? 'var(--sig)' : 'var(--color-accent)',
                color: '#151f29',
                padding: '3px 7px',
              }}
            >
              {inClass ? 'AFTER THIS CLASS' : live ? 'RIGHT NOW' : 'UP NEXT'}
            </span>
            <span style={{ ...mono(12), letterSpacing: '.1em', color: 'var(--color-accent)' }}>
              {focus.timeStr}
            </span>
            {focus.course && (
              <span style={{ ...mono(12), letterSpacing: '.1em', color: 'var(--color-accent)' }}>
                {focus.course}
              </span>
            )}
            <span className="tag tag-outline" style={{ ...mono(10), color: TAG[focus.tag]?.color, borderColor: TAG[focus.tag]?.color }}>
              {TAG[focus.tag]?.label || focus.tag}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.08,
              textWrap: 'pretty',
            }}
          >
            {focus.title}
          </div>

          <div style={{ fontSize: 14, color: 'rgba(238,243,248,.82)', marginTop: 9, maxWidth: 720 }}>
            {focus.action}
          </div>

          <div style={{ ...mono(11.5), color: dim, marginTop: 8 }}>{focus.why}</div>

          {focus.material && (
            <div style={{ ...mono(11.5), marginTop: 10, color: 'var(--color-accent)' }}>
              OPEN → <span style={{ color: 'rgba(238,243,248,.8)' }}>{focus.material.name}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className={focus.done ? 'btn btn-secondary' : 'btn btn-primary'}
              onClick={() => actions.toggleSlot(day.date, focus)}
              style={{ fontSize: 12.5, letterSpacing: '.06em' }}
            >
              {focus.done ? 'Worked — undo' : `Mark this ${focus.minutes} min block worked`}
            </button>
            {focus.courseId && (
              <button
                className="btn btn-secondary"
                onClick={() => actions.openErrorFor(focus.courseId)}
                style={{ fontSize: 12.5 }}
              >
                Log an error
              </button>
            )}
            {focus.courseId && (
              <button
                className="btn btn-ghost"
                onClick={() => actions.openStuckFor(focus.courseId)}
                style={{ fontSize: 12.5 }}
              >
                I'm stuck
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── the day ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {timeline.map((row) =>
          row.row === 'class' ? (
            <div
              key={`c-${row.id}`}
              style={{
                display: 'flex',
                gap: 14,
                padding: '8px 10px',
                borderTop: '1px solid rgba(238,243,248,.09)',
                borderLeft: '2px solid rgba(148,188,227,.5)',
                background: 'rgba(148,188,227,.05)',
                alignItems: 'baseline',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ ...mono(11.5), color: dim, minWidth: 108 }}>{row.timeStr}</span>
              <span style={{ ...mono(11.5), letterSpacing: '.1em', color: 'var(--color-accent)' }}>
                {row.course}
              </span>
              <span style={{ ...mono(10), letterSpacing: '.1em', color: dim }}>{row.kind}</span>
              <span style={{ fontSize: 12.5, color: dim }}>in class</span>
            </div>
          ) : (
            <div
              key={`s-${row.key}`}
              style={{
                display: 'flex',
                gap: 14,
                padding: '11px 10px',
                borderTop: '1px solid rgba(238,243,248,.09)',
                borderLeft: `2px solid ${row.done ? '#9ad6b4' : TAG[row.tag]?.color || dim}`,
                alignItems: 'flex-start',
                opacity: row.spare && !row.done ? 0.62 : 1,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ ...mono(11.5), color: 'rgba(238,243,248,.7)', minWidth: 108, paddingTop: 2 }}>
                {row.timeStr}
              </span>

              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {row.course && (
                    <span style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)' }}>
                      {row.course}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 14.5,
                      fontWeight: 500,
                      textDecoration: row.done ? 'line-through' : 'none',
                      color: row.done ? dim : 'var(--color-text)',
                    }}
                  >
                    {row.title}
                  </span>
                  <span style={{ ...mono(9.5), letterSpacing: '.12em', color: TAG[row.tag]?.color || dim }}>
                    {TAG[row.tag]?.label || row.tag}
                  </span>
                  {row.trap && (
                    <span style={{ ...mono(9.5), letterSpacing: '.12em', color: 'var(--sig)' }}>TRAP</span>
                  )}
                  {row.spare && (
                    <span style={{ ...mono(9.5), letterSpacing: '.12em', color: dim }}>BEYOND TARGET</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.72)', marginTop: 4 }}>
                  {row.action}
                </div>
                <div style={{ ...mono(10.5), color: dim, marginTop: 3 }}>
                  {row.why}
                  {row.material ? ` · open ${row.material.name}` : ''}
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => actions.toggleSlot(day.date, row)}
                style={{
                  fontSize: 10.5,
                  padding: '3px 8px',
                  letterSpacing: '.08em',
                  whiteSpace: 'nowrap',
                  color: row.done ? '#9ad6b4' : undefined,
                  borderColor: row.done ? 'rgba(154,214,180,.5)' : undefined,
                }}
              >
                {row.done ? 'WORKED' : 'MARK'}
              </button>
            </div>
          )
        )}
        {!timeline.length && (
          <div style={{ ...mono(12), color: dim, padding: '18px 0' }}>
            No study window today. Widen it in Config if that is wrong.
          </div>
        )}
      </div>

      {/* ── the week ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>The next seven days</h6>
        <span style={{ fontSize: 12, color: dim }}>
          each day's work is retired from the next, so this is a plan rather than the same list seven times
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {week.map((wd) => (
          <div
            key={wd.date}
            className="card"
            style={{
              flex: '1 0 150px',
              minWidth: 150,
              padding: '11px 12px',
              gap: 6,
              borderColor: wd.isToday ? 'var(--color-accent)' : 'var(--color-divider)',
              background: wd.isToday ? 'rgba(148,188,227,.07)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...mono(11), letterSpacing: '.12em', color: 'var(--color-accent)' }}>
                {wd.dayName.toUpperCase()} {wd.dayNum}
              </span>
              <span style={{ ...mono(10), color: dim }}>{hoursStr(wd.capacityMin)}</span>
            </div>

            {wd.due.length > 0 && (
              <div style={{ ...mono(10), color: 'var(--sig)', letterSpacing: '.06em' }}>
                {wd.due.map((x) => `DUE · ${x.course} ${x.title}`).join(' / ')}
              </div>
            )}

            <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>
              {wd.focus ? (
                <>
                  {wd.focus.course && (
                    <span style={{ ...mono(10.5), color: 'var(--color-accent)' }}>{wd.focus.course} </span>
                  )}
                  {wd.focus.title}
                </>
              ) : (
                <span style={{ color: dim }}>nothing scheduled</span>
              )}
            </div>

            <div style={{ ...mono(9.5), color: dim, letterSpacing: '.06em' }}>
              {wd.classCount ? `${wd.classCount} class${wd.classCount > 1 ? 'es' : ''} · ` : ''}
              {hoursStr(wd.committedMin)} committed
            </div>
          </div>
        ))}
      </div>

      {/* ── why the plan looks like this ───────────────────────────────── */}
      <div className="blueprint" style={{ padding: '14px 16px' }}>
        <Corners />
        <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>
          WHERE THIS PLAN COMES FROM
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.68)', marginTop: 6, lineHeight: 1.55, maxWidth: 860 }}>
          Nothing above is stored. The blocks are your study window minus your timetable, filled from the
          same triage ranking the Triage view shows. Confirm a date in the review queue and tomorrow is
          already different — there is no plan to regenerate.
          {deck.unconfirmedDated > 0 && (
            <>
              {' '}
              <button className="btn btn-ghost" onClick={onGoQueue} style={{ fontSize: 12.5, padding: 0 }}>
                {deck.unconfirmedDated} scanned date{deck.unconfirmedDated > 1 ? 's are' : ' is'} still
                unconfirmed
              </button>{' '}
              and invisible to this plan until you confirm them.
            </>
          )}
          {deck.undatedExams.length > 0 && (
            <>
              {' '}
              {deck.undatedExams.length} exam{deck.undatedExams.length > 1 ? 's have' : ' has'} no date yet,
              so {deck.undatedExams.length > 1 ? 'they cannot' : 'it cannot'} be tapered — until then those
              courses appear here as retrieval practice.
            </>
          )}{' '}
          <button className="btn btn-ghost" onClick={onGoConfig} style={{ fontSize: 12.5, padding: 0 }}>
            Change the hours or the timetable
          </button>
          .
        </div>
      </div>
    </div>
  );
}
