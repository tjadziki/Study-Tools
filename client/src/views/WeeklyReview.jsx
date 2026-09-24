import React from 'react';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Stat, Kbd } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';

const STEPS = [
  { text: 'Close out or escalate every open concept older than 7 days.', tail: true },
  { text: 'Confirm next week’s practice blocks are in the calendar.' },
  { text: 'Re-estimate hours on the top 5 triage items — bad estimates corrupt the ranking.' },
  { text: 'One line: what actually ate my time this week?' },
];

export default function WeeklyReview({ deck, onStart }) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="flex flex-wrap items-end gap-8 p-6">
          <Stat label="Streak" value={deck.header.reviewStreakStr} size="lg" />
          <Stat label="Last review" value={deck.lastReviewStr} size="sm" />
          <Stat label="Next due" value={deck.nextReviewStr} size="sm" tone="blue" />
          <Button size="lg" onClick={onStart} className="ml-auto">
            <NotebookPen />
            Run the review
            <Kbd className="border-white/30 bg-white/15 text-white shadow-none">W</Kbd>
          </Button>
        </Card>

        <ListSection header="The four steps" footer="About twenty minutes, every Sunday.">
          {STEPS.map((s, i) => (
            <ListRow key={i} className="items-start py-3" style={{ '--sep-inset': '3.25rem' }}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-caption font-bold text-tint-blue">
                {i + 1}
              </span>
              <span className="text-subhead text-pretty">
                {s.text}
                {s.tail && <span className="text-muted-foreground"> {deck.staleCountStr}</span>}
              </span>
            </ListRow>
          ))}
        </ListSection>
      </div>

      <ListSection header="Reflection log">
        {deck.reviews.map((rf, i) => (
          <ListRow key={i} className="flex-col items-start gap-0.5 py-3">
            <span className="text-caption font-medium text-muted-foreground">{rf.dateStr}</span>
            <span className="text-subhead text-pretty">{rf.text}</span>
          </ListRow>
        ))}
        {deck.reviews.length === 0 && (
          <ListRow>
            <span className="text-footnote text-muted-foreground">
              No reviews logged yet. The first one is due {deck.nextReviewStr}.
            </span>
          </ListRow>
        )}
      </ListSection>
    </div>
  );
}
