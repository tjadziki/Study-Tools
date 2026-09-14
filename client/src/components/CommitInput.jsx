import React, { useEffect, useRef, useState } from 'react';

/**
 * A text/date cell that edits locally and only commits when the edit is over.
 *
 * Two rules make the native date picker behave:
 *
 *  1. The DOM node is never replaced. Keying an input on its own value means
 *     any commit remounts it, and remounting an <input type="date"> tears down
 *     the open calendar popup with it. So the value lives in local state and
 *     the element is stable for the life of the row.
 *
 *  2. Nothing is written while the field still has focus. Stepping the month
 *     in the picker fires change events with intermediate values; committing
 *     those would save a date the user never chose (and, here, mark it
 *     confirmed). Commits happen on blur, on Enter, or after a quiet pause.
 *
 * Upstream values are adopted only while the field is unfocused, so a
 * background refresh cannot yank text out from under someone mid-edit.
 */
export default function CommitInput({
  value,
  onCommit,
  type = 'text',
  quietMs = 0,
  ...rest
}) {
  const [local, setLocal] = useState(value ?? '');
  const focused = useRef(false);
  const committed = useRef(value ?? '');
  const timer = useRef(null);

  useEffect(() => {
    if (focused.current) return;
    setLocal(value ?? '');
    committed.current = value ?? '';
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (v) => {
    clearTimeout(timer.current);
    if (v === committed.current) return;
    committed.current = v;
    onCommit(v);
  };

  return (
    <input
      {...rest}
      type={type}
      value={local}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (!quietMs) return;
        // A pause long enough to mean "done clicking around in the picker".
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (!focused.current) return commit(v);
          commit(v);
        }, quietMs);
      }}
      onBlur={(e) => {
        focused.current = false;
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          setLocal(committed.current);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
