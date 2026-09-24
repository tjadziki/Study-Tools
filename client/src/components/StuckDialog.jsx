import React from 'react';
import { Timer, ArrowUpRight } from 'lucide-react';
import { LADDER } from '../lib/deck.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogEyebrow,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Progress, CheckCircle } from '@/components/ui/misc';

export default function StuckDialog({
  open, deck, phase, stuck, draft, setDraft, minutes, now, onStart, onClose, onEscalateNow, actions,
}) {
  const activeConcept = stuck.conceptId ? deck.conceptList.find((c) => c.id === stuck.conceptId) : null;
  const remain = phase === 'run' ? Math.max(0, stuck.endsAt - now) : 0;
  const ladderCourseId = activeConcept ? activeConcept.courseId : draft.courseId;
  const contact = deck.byId[ladderCourseId]?.contact || '';
  const clock =
    String(Math.floor(remain / 60000)).padStart(2, '0') + ':' + String(Math.floor(remain / 1000) % 60).padStart(2, '0');
  const shownText = activeConcept ? activeConcept.text : draft.text || '';

  // A course the deck no longer has (after a change of courses) selects nothing.
  const courseId = deck.courses.some((c) => c.id === draft.courseId) ? draft.courseId : deck.courses[0]?.id;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {phase === 'draft' && (
          <>
            <DialogHeader>
              <DialogEyebrow tone="orange">Stuck timer · {minutes} min</DialogEyebrow>
              <DialogTitle>Write the exact sentence where you lost the thread.</DialogTitle>
              <DialogDescription>Then work it for {minutes} minutes. If it is still stuck, you escalate — not grind.</DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Segmented
                ariaLabel="Course"
                size="sm"
                value={courseId}
                onChange={(id) => setDraft({ ...draft, courseId: id })}
                options={deck.courses.map((c) => ({ value: c.id, label: c.code }))}
              />
            </div>
            <Textarea
              autoFocus
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="e.g. I don't see why the Kalman gain shrinks as the measurement noise grows."
            />
            <DialogFooter>
              <Button variant="gray" onClick={onClose}>Cancel</Button>
              <Button onClick={onStart}>
                <Timer />
                Start {minutes}:00
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'run' && (
          <>
            <DialogHeader>
              <DialogEyebrow tone="orange">{deck.code(ladderCourseId)} · timer running</DialogEyebrow>
              <DialogTitle className="sr-only">Stuck timer</DialogTitle>
            </DialogHeader>
            <div className="text-center">
              <div className="font-display text-[4.5rem] font-light leading-none tracking-tight tabular">{clock}</div>
              <Progress value={(remain / (minutes * 60000)) * 100} tone="orange" className="mx-auto mt-4 max-w-sm" />
            </div>
            <p className="rounded-xl bg-secondary p-3.5 text-subhead text-pretty">{shownText}</p>
            <DialogDescription>When this reaches zero the timer does not restart. You escalate.</DialogDescription>
            <DialogFooter>
              <Button variant="gray" onClick={onClose}>Keep working (hide)</Button>
              <Button onClick={onEscalateNow}>
                <ArrowUpRight />
                Escalate now
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'ladder' && (
          <>
            <DialogHeader>
              <DialogEyebrow tone="orange">{deck.code(ladderCourseId)} · time is up — escalation ladder</DialogEyebrow>
              <DialogTitle>Three hours on one concept is a decision, not an accident.</DialogTitle>
            </DialogHeader>
            <p className="rounded-xl bg-secondary p-3.5 text-subhead text-pretty">{shownText}</p>
            <ol className="flex flex-col">
              {LADDER.map((l, i) => {
                const on = !!(activeConcept && activeConcept.rungs[i]);
                return (
                  <li key={l.step} className={cn('flex items-start gap-3 py-3', i > 0 && 'border-t border-border')}>
                    <CheckCircle
                      checked={on}
                      label={`${l.title} done`}
                      onClick={() => {
                        if (!activeConcept) return;
                        const rungs = activeConcept.rungs.slice();
                        rungs[i] = !rungs[i];
                        actions.patchConcept(activeConcept.id, { rungs });
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-caption font-semibold text-tint-orange">Rung {i + 1}</span>
                        <span className="text-headline font-semibold">{l.title}</span>
                      </div>
                      <p className="mt-0.5 text-footnote text-muted-foreground text-pretty">
                        {i === 2 ? `${deck.code(ladderCourseId)} → ${contact}` : l.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {activeConcept && (
              <p className="text-caption text-muted-foreground">
                Logged to open concepts ·{' '}
                {new Date(activeConcept.openedAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <DialogFooter>
              <Button variant="gray" onClick={onClose}>Leave it open</Button>
              <Button onClick={() => activeConcept && actions.resolveConcept(activeConcept.id)}>Resolved — close it</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
