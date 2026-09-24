import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogEyebrow,
} from '@/components/ui/dialog';
import { Input, Textarea, Field } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';

export default function ErrorDialog({ open, deck, form, setForm, onClose, onSave }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogEyebrow tone="blue">Error log entry</DialogEyebrow>
          <DialogTitle>What was the reason — not the question number?</DialogTitle>
        </DialogHeader>

        {deck.examCourses.length > 0 && (
          <div className="overflow-x-auto">
            <Segmented
              ariaLabel="Course"
              value={form.courseId}
              onChange={(id) => setForm({ ...form, courseId: id })}
              options={deck.examCourses.map((c) => ({ value: c.id, label: c.code }))}
            />
          </div>
        )}

        <Field label="Topic">
          <Input
            autoFocus
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Kalman gain · Simplex pivoting · Shape functions"
          />
        </Field>
        <Field label="What I got wrong — the reason, in a line or two">
          <Textarea
            value={form.what}
            onChange={(e) => setForm({ ...form, what: e.target.value })}
            placeholder="Picked the entering variable by the largest coefficient instead of the most negative reduced cost."
          />
        </Field>

        <DialogFooter>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}>Bank it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
