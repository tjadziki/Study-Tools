import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };

export default function Exams({ deck }) {
  const { examRows, undatedExams, rules } = deck;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="blueprint"
        style={{ padding: '16px 18px', borderColor: 'rgba(226,145,63,.5)', background: 'rgba(226,145,63,.06)' }}
      >
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>THE STRUCTURAL FACT</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 25,
            marginTop: 5,
            textWrap: 'pretty',
          }}
        >
          ME 524 decides 84% of its grade in two sittings, and has no TA.
        </div>
        <div style={{ fontSize: 13, color: 'rgba(238,243,248,.65)', marginTop: 5 }}>
          Its three assignments are the only practice that exists before those sittings. That is why they outrank
          their weight.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Exam taper</h6>
        <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
          back-planned from each date · dates marked <span style={{ fontFamily: 'var(--font-mono)' }}>est.</span> need
          confirming on LEARN
        </span>
      </div>

      {undatedExams.length > 0 && (
        <div className="card" style={{ padding: '13px 15px', gap: 6, borderColor: 'rgba(226,145,63,.4)' }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>NOT YET BACK-PLANNABLE</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            {undatedExams.length} exam{undatedExams.length === 1 ? '' : 's'} have no confirmed date, so no taper can
            be drawn for them:{' '}
            <span style={{ color: 'rgba(238,243,248,.65)' }}>
              {undatedExams.map((x) => `${x.course} ${x.name} (${x.weightStr})`).join(' · ')}
            </span>
            .
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {examRows.map((x) => (
          <div key={x.id} className="card" style={{ padding: '15px 16px', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                  {x.course}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.1 }}>
                  {x.name}
                </div>
                <div style={{ ...mono(11.5), color: 'rgba(238,243,248,.5)', marginTop: 3 }}>{x.dateStr}</div>
              </div>
              <div style={{ display: 'flex', gap: 22, flex: 'none' }}>
                <div>
                  <div style={kicker}>WEIGHT</div>
                  <div style={mono(24, { lineHeight: 1.1 })}>{x.weightStr}</div>
                </div>
                <div>
                  <div style={kicker}>T-MINUS</div>
                  <div style={mono(24, { lineHeight: 1.1 })}>{x.daysStr}</div>
                </div>
                <div>
                  <div style={kicker}>ERRORS BANKED</div>
                  <div style={mono(24, { lineHeight: 1.1, color: 'var(--color-accent)' })}>{x.bankStr}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {x.steps.map((st) => (
                <div
                  key={st.label}
                  style={{
                    flex: '1 1 150px',
                    minWidth: 0,
                    borderTop: '2px solid rgba(238,243,248,.14)',
                    padding: '9px 12px 0 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span
                      style={{
                        ...mono(11),
                        letterSpacing: '.1em',
                        color: st.past ? 'rgba(238,243,248,.35)' : 'var(--color-accent)',
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={mono(10.5, { color: 'rgba(238,243,248,.4)' })}>{st.dateStr}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.4,
                      marginTop: 4,
                      color: 'rgba(238,243,248,.75)',
                      textWrap: 'pretty',
                    }}
                  >
                    {st.what}
                  </div>
                </div>
              ))}
            </div>

            {x.warn && (
              <div
                style={{
                  borderLeft: '2px solid var(--sig)',
                  padding: '6px 0 6px 11px',
                  background: 'rgba(226,145,63,.07)',
                }}
              >
                <div style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--sig)' }}>CRAMMING RISK HIGH</div>
                <div style={{ fontSize: 13, marginTop: 3 }}>
                  Not enough retrieval practice banked — {x.bankStr} entries against a floor of {rules.minErr} at
                  T-14.
                </div>
              </div>
            )}

            {x.projection && (
              <div
                style={{
                  ...mono(11.5),
                  color: 'rgba(238,243,248,.55)',
                  borderTop: '1px solid rgba(238,243,248,.1)',
                  paddingTop: 9,
                }}
              >
                {x.projectionStr}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
