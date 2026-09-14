import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };

const STEPS = [
  { n: '01', text: 'Close out or escalate every open concept older than 7 days.', tail: true },
  { n: '02', text: "Confirm next week's three practice blocks are in the calendar." },
  { n: '03', text: 'Re-estimate hours on the top 5 triage items — bad estimates corrupt the ranking.' },
  { n: '04', text: 'One line: what actually ate my time this week?' },
];

export default function WeeklyReview({ deck, onStart }) {
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Sunday weekly review</h6>
          <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
            20 minutes · the habit that holds the rest together
          </span>
        </div>

        <div className="blueprint" style={{ padding: '18px 20px' }}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={kicker}>STREAK</div>
              <div style={mono(38, { lineHeight: 1 })}>{deck.header.reviewStreakStr}</div>
            </div>
            <div>
              <div style={kicker}>LAST REVIEW</div>
              <div style={mono(15)}>{deck.lastReviewStr}</div>
              <div style={{ ...kicker, marginTop: 9 }}>NEXT DUE</div>
              <div style={mono(15, { color: 'var(--color-accent)' })}>{deck.nextReviewStr}</div>
            </div>
            <button
              className="btn btn-primary"
              onClick={onStart}
              style={{ fontSize: 13, letterSpacing: '.07em', marginLeft: 'auto', gap: 8, whiteSpace: 'nowrap' }}
            >
              Run the review{' '}
              <span style={{ ...mono(10), border: '1px solid rgba(21,31,41,.35)', padding: '0 4px' }}>W</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 16 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: 'flex', gap: 11, padding: '9px 0', borderTop: '1px solid rgba(238,243,248,.12)' }}>
                <span style={{ ...mono(11), color: 'var(--color-accent)', flex: 'none' }}>{s.n}</span>
                <span style={{ fontSize: 13.5 }}>
                  {s.text}
                  {s.tail && <span style={{ color: 'rgba(238,243,248,.5)' }}> {deck.staleCountStr}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: '1 1 300px', maxWidth: 440, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Reflection log</h6>
        {deck.reviews.map((rf, i) => (
          <div key={i} className="card" style={{ padding: '12px 14px', gap: 4 }}>
            <div style={{ ...mono(10.5), letterSpacing: '.09em', color: 'rgba(238,243,248,.45)' }}>{rf.dateStr}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>{rf.text}</div>
          </div>
        ))}
        {deck.reviews.length === 0 && (
          <div style={{ fontSize: 13, color: 'rgba(238,243,248,.45)' }}>
            No reviews logged yet. The first one is due {deck.nextReviewStr}.
          </div>
        )}
      </div>
    </div>
  );
}
