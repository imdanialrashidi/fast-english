// admin/src/features/content/unsaved.ts
// Podcast Slice 4 — unsaved-changes tracking for editors.
//
// Explicit dirty tracking (no aggressive global beforeunload when
// nothing changed) + a React Router blocker that warns the Staff
// before navigating away with unsaved edits. Pure logic is separated
// for unit tests; the hook wires it to the router.

import { useCallback, useState } from 'react';
import { type Blocker, useBlocker } from 'react-router';

export interface UnsavedState {
  isDirty: boolean;
  /** true while a save is in flight (double-submit prevention). */
  isSaving: boolean;
  /** last persisted ack from the server: 'saved' | 'error' | null */
  saveState: 'saved' | 'error' | null;
  markDirty: () => void;
  beginSave: () => void;
  finishSave: (ok: boolean) => void;
  reset: () => void;
}

/** Pure transition logic (unit-testable). */
export type SaveEvent = 'dirty' | 'save_start' | 'save_ok' | 'save_error' | 'reset';

export interface UnsavedModel {
  isDirty: boolean;
  isSaving: boolean;
  saveState: 'saved' | 'error' | null;
}

export function unsavedReducer(model: UnsavedModel, event: SaveEvent): UnsavedModel {
  switch (event) {
    case 'dirty':
      return model.isSaving ? model : { ...model, isDirty: true, saveState: null };
    case 'save_start':
      return { ...model, isSaving: true };
    case 'save_ok':
      return { isDirty: false, isSaving: false, saveState: 'saved' };
    case 'save_error':
      return { ...model, isSaving: false, saveState: 'error', isDirty: true };
    case 'reset':
      return { isDirty: false, isSaving: false, saveState: null };
  }
}

const INITIAL: UnsavedModel = { isDirty: false, isSaving: false, saveState: null };

/**
 * Dirty-state hook with router-blocking. When a save is in flight the
 * model stays dirty-blocked so a navigation mid-save cannot silently
 * discard the request.
 */
export interface UnsavedStateWithBlocker extends UnsavedState {
  blocker: Blocker;
}

export function useUnsavedState(): UnsavedStateWithBlocker {
  const [model, setModel] = useState<UnsavedModel>(INITIAL);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return model.isDirty && currentLocation.pathname !== nextLocation.pathname;
  });

  const markDirty = useCallback(() => setModel((m) => unsavedReducer(m, 'dirty')), []);
  const beginSave = useCallback(() => setModel((m) => unsavedReducer(m, 'save_start')), []);
  const finishSave = useCallback(
    (ok: boolean) => setModel((m) => unsavedReducer(m, ok ? 'save_ok' : 'save_error')),
    [],
  );
  const reset = useCallback(() => setModel((m) => unsavedReducer(m, 'reset')), []);

  return {
    isDirty: model.isDirty,
    isSaving: model.isSaving,
    saveState: model.saveState,
    markDirty,
    beginSave,
    finishSave,
    reset,
    blocker,
  };
}

/** Blocker dialog copy (also used by unit tests). */
export const UNSAVED_DIALOG_TITLE = 'تغییرات ذخیرهنشده';
export const UNSAVED_DIALOG_BODY = 'تغییرات این صفحه هنوز ذخیره نشدهاند. خارج میشوید؟';
