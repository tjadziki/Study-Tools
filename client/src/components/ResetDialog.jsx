import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function ResetDialog({ open, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]" hideClose>
        <DialogHeader className="pr-0 text-center">
          <DialogTitle>Reset the whole deck?</DialogTitle>
          <DialogDescription>
            Your error log, open concepts, practice streaks, confirmed dates and every edited weight go with it. The
            seeded term comes back. Your course files on disk are not touched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2">
          <Button variant="gray" onClick={onCancel} autoFocus>Keep my data</Button>
          <Button variant="destructive" onClick={onConfirm}>Reset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
