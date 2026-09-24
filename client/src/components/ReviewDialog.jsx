import React from 'react';
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
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from '@/components/ui/misc';

export default function ReviewDialog({
  open, deck, step, setStep, actions, reflectionDraft, setReflectionDraft, onClose, onFinish,
}) {
  const top5 = deck.triage.rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(620px,calc(100vw-2rem))]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogEyebrow tone="blue">Weekly review</DialogEyebrow>
            {/* Four dots for four steps, as a page control. */}
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn('size-1.5 rounded-full', i === step ? 'bg-primary' : 'bg-label-3')} />
              ))}
            </div>
            <span className="text-caption text-muted-foreground">~20 min</span>
          </div>
          <DialogTitle>
            {step === 0 && 'Every concept older than 7 days gets closed or escalated.'}
            {step === 1 && `Next week’s practice blocks — ${deck.nextFridayStr}.`}
            {step === 2 && 'Re-estimate the top 5. Bad estimates corrupt the ranking.'}
            {step === 3 && 'What actually ate my time this week?'}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="flex flex-col">
            {deck.stale.map((rc, i) => (
              <div key={rc.id} className={cn('py-3', i > 0 && 'border-t border-border')}>
                <div className="flex items-center gap-2">
                  <span className="text-footnote font-semibold text-tint-blue">{rc.course}</span>
                  <Badge tone="orange">{rc.ageStr}</Badge>
                </div>
                <p className="mt-1 text-subhead text-pretty">{rc.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="tinted" size="sm" onClick={() => actions.resolveConcept(rc.id)}>Resolved</Button>
                  <Button variant="gray" size="sm" onClick={() => actions.escalateConcept(rc.id)}>
                    Booked with {deck.byId[rc.courseId]?.contactShort || 'the course'}
                  </Button>
                </div>
              </div>
            ))}
            {deck.stale.length === 0 && <DialogDescription>Nothing older than 7 days. Clean board.</DialogDescription>}
          </div>
        )}

        {step === 1 && (
          <div className="overflow-hidden rounded-xl bg-secondary/60">
            {deck.nextBlocks.map((nb, i) => (
              <button
                key={nb.courseId}
                role="checkbox"
                aria-checked={nb.done}
                onClick={() => actions.togglePlanned(nb.date, nb.courseId)}
                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary', i > 0 && 'border-t border-border')}
              >
                <CheckCircle checked={nb.done} decorative />
                <span className="text-subhead font-medium">{nb.course} · 90 min</span>
                <span className="ml-auto text-footnote text-muted-foreground">{nb.done ? 'Scheduled' : 'Not yet'}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col">
            {top5.map((rt, i) => (
              <div key={rt.id} className={cn('flex items-center gap-3 py-2.5', i > 0 && 'border-t border-border')}>
                <div className="min-w-0 flex-1">
                  <div className="text-footnote font-semibold text-tint-blue">{rt.course}</div>
                  <div className="truncate text-subhead">{rt.title}</div>
                </div>
                <Input
                  key={`${rt.id}-${rt.estStr}`}
                  aria-label={`${rt.title} estimated hours`}
                  inputMode="decimal"
                  defaultValue={parseFloat(rt.estStr)}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v > 0) actions.patchTask(rt.id, { estHours: v });
                  }}
                  className="w-20"
                />
                <span className="text-footnote text-muted-foreground">hours</span>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <Textarea
            autoFocus
            value={reflectionDraft}
            onChange={(e) => setReflectionDraft(e.target.value)}
            placeholder="One line. Honest."
          />
        )}

        <DialogFooter>
          {step > 0 && (
            <Button variant="plain" className="mr-auto" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          <Button variant="gray" onClick={onClose}>Later</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(Math.min(3, step + 1))}>Next</Button>
          ) : (
            <Button onClick={onFinish}>Close the week</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
