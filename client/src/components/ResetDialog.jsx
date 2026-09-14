import React from 'react';

export default function ResetDialog({ onCancel, onConfirm }) {
  return (
    <div className="dialog-backdrop" style={{ zIndex: 70 }}>
      <div className="dialog" style={{ borderColor: 'rgba(226,145,63,.45)' }}>
        <div className="dialog-title">Reset the whole deck?</div>
        <div className="dialog-body">
          Error log, open concepts, practice streaks and every edited weight go with it. The seeded Fall 2026 term
          comes back. Your course files on disk are not touched.
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel} style={{ fontSize: 12.5 }}>Keep my data</button>
          <button className="btn btn-primary" onClick={onConfirm} style={{ fontSize: 12.5 }}>Reset</button>
        </div>
      </div>
    </div>
  );
}
