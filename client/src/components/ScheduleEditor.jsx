import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { hhmm } from '../lib/plan.js';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input, NativeSelect, Field } from '@/components/ui/input';

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
 * from. Timetable edits stay local until Save, because it is written as a
 * whole and a half-finished row would hand the planner an hour that does not
 * exist. The window's numbers save as each field is left.
 */
export default function ScheduleEditor({ deck, actions }) {
  const { courses, settings } = deck;
  const week = deck.today ? deck.weekPlan : null;
  const blocks = useMemo(
    () => (deck.classBlocks || []).slice().sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin),
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
      { id: `new-${Date.now().toString(36)}`, courseId: courses[0]?.id, weekday: 1, startMin: 600, endMin: 680, kind: 'LEC', label: '' },
    ]);
  };

  const broken = draft.filter((b) => !(b.endMin > b.startMin));

  const num = (key, fallback) => {
    const v = Number(settings[key]);
    return Number.isFinite(v) ? v : fallback;
  };
  const setTime = (key) => (e) => {
    const m = toMin(e.target.value);
    if (m != null && String(m) !== settings[key]) actions.settings({ [key]: String(m) });
  };
  const setNum = (key) => (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v > 0 && String(v) !== settings[key]) actions.settings({ [key]: String(v) });
  };

  const weeklyCapacity = week ? week.reduce((a, day) => a + day.capacityMin, 0) : 0;
  const weeklyTarget = week ? week.reduce((a, day) => a + day.targetMin, 0) : 0;

  // `key` on each field remounts it when the server value changes, so the
  // uncontrolled input picks the new value up without fighting the typist.
  const WINDOW = [
    { key: 'dayStartMin', label: 'Start the day', type: 'time', def: 450 },
    { key: 'dayEndMin', label: 'Hard stop', type: 'time', def: 1260 },
    { key: 'dailyTargetHours', label: 'Target h / weekday', def: 4 },
    { key: 'weekendTargetHours', label: 'Target h / weekend day', def: 4 },
    { key: 'minBlockMinutes', label: 'Shortest block', def: 45 },
    { key: 'maxBlockMinutes', label: 'Longest block', def: 110 },
    { key: 'breakMinutes', label: 'Break', def: 15 },
    { key: 'classBufferMinutes', label: 'Buffer around class', def: 15 },
    { key: 'focusHoursPerDay', label: 'Focus h / task / day', def: 2 },
    { key: 'urgentSlackDays', label: 'Urgent under (days slack)', def: 7 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Study window</CardTitle>
          <CardDescription>
            The daily plan is this window minus your classes.
            {week && ` That leaves ${(weeklyCapacity / 60).toFixed(1)} h free over the next seven days, against a target of ${(weeklyTarget / 60).toFixed(0)} h.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {WINDOW.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                key={`${f.key}-${settings[f.key]}`}
                type={f.type || 'text'}
                inputMode={f.type ? undefined : 'decimal'}
                defaultValue={f.type === 'time' ? hhmm(num(f.key, f.def)) : num(f.key, f.def)}
                onBlur={f.type === 'time' ? setTime(f.key) : setNum(f.key)}
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Timetable</CardTitle>
          <CardDescription>From Quest. Change a class and Today rebuilds as soon as you save.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="text-caption uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-5 pr-2 font-medium">Course</th>
                <th className="px-2 py-2 font-medium">Day</th>
                <th className="px-2 py-2 font-medium">Start</th>
                <th className="px-2 py-2 font-medium">End</th>
                <th className="px-2 py-2 font-medium">Kind</th>
                <th className="py-2 pl-2 pr-5" />
              </tr>
            </thead>
            <tbody>
              {draft.map((b, i) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-2 pl-5 pr-2">
                    <NativeSelect className="h-8 w-28" aria-label="Course" value={b.courseId} onChange={(e) => edit(i, { courseId: e.target.value })}>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code}</option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-2 py-2">
                    <NativeSelect className="h-8 w-24" aria-label="Day" value={b.weekday} onChange={(e) => edit(i, { weekday: Number(e.target.value) })}>
                      {DAYS.map((d) => (
                        <option key={d.n} value={d.n}>{d.label}</option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="time"
                      aria-label="Start"
                      className="h-8 w-32"
                      value={hhmm(b.startMin)}
                      onChange={(e) => {
                        const m = toMin(e.target.value);
                        if (m != null) edit(i, { startMin: m });
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="time"
                      aria-label="End"
                      className={`h-8 w-32 ${b.endMin > b.startMin ? '' : 'ring-2 ring-ios-red'}`}
                      value={hhmm(b.endMin)}
                      onChange={(e) => {
                        const m = toMin(e.target.value);
                        if (m != null) edit(i, { endMin: m });
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <NativeSelect className="h-8 w-24" aria-label="Kind" value={b.kind} onChange={(e) => edit(i, { kind: e.target.value })}>
                      <option value="LEC">Lecture</option>
                      <option value="LAB">Lab</option>
                      <option value="TUT">Tutorial</option>
                      <option value="PRJ">Project</option>
                    </NativeSelect>
                  </td>
                  <td className="py-2 pl-2 pr-5 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Remove class" className="text-muted-foreground hover:text-tint-red" onClick={() => remove(i)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3.5">
          <Button variant="tinted" onClick={add}>
            <Plus />
            Add a class
          </Button>
          <Button
            disabled={!dirty || broken.length > 0}
            onClick={async () => {
              await actions.saveClassBlocks(draft);
              setDirty(false);
            }}
          >
            Save timetable
          </Button>
          {dirty && (
            <Button
              variant="plain"
              onClick={() => {
                setDraft(blocks);
                setDirty(false);
              }}
            >
              Discard
            </Button>
          )}
          <span className={`text-footnote ${broken.length ? 'font-medium text-tint-red' : 'text-muted-foreground'}`}>
            {broken.length
              ? `${broken.length} class${broken.length > 1 ? 'es end' : ' ends'} before starting`
              : dirty
                ? 'Unsaved — Today still shows the old timetable'
                : ''}
          </span>
        </div>
      </Card>
    </div>
  );
}
