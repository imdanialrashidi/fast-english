<?php

namespace App\Http\Controllers;

use App\Jobs\CreateBackupJob;
use App\Jobs\RestoreBackupJob;
use App\Models\Backup;
use App\Support\BackupManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Staff-only backup endpoints (OPS-01).
 *
 * All routes sit behind `auth` + `staff` (EnsureStaff: active staff only;
 * students 403, guests to login). The Filament Backups page posts here so
 * every operation has an HTTP-testable server-side boundary — Livewire
 * state is never trusted for destructive work.
 *
 * Every response is private (global PrivateNoStore); downloads stream
 * from the private disk with `private, no-store` and an attachment
 * disposition. Logs carry counts/sizes/ids only — never archive bytes,
 * passwords, 2FA material, receipt images, or env values.
 */
class BackupController extends Controller
{
    /** One-click create: validates concurrency, then runs the verified path. */
    public function store(Request $request)
    {
        $staff = $request->user();
        $this->ensureStaff($staff);

        // Synchronous path keeps the panel one-click for current data
        // sizes; the same work is available queued via CreateBackupJob for
        // scheduler/CLI use. The row lifecycle is the status mechanism.
        try {
            $backup = BackupManager::createBackup($staff, Backup::TYPE_MANUAL);
        } catch (ValidationException $e) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors($e->errors());
        }

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Backup #'.$backup->id.' completed ('.$this->humanBytes((int) $backup->size_bytes).').');
    }

    /** Queue a create for very large libraries (same verified path). */
    public function dispatchCreate(Request $request)
    {
        $staff = $request->user();
        $this->ensureStaff($staff);

        if (Backup::whereIn('status', [Backup::STATUS_CREATING, Backup::STATUS_RESTORING])->exists()) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors(['backup' => 'A backup or restore operation is already running. Please wait and refresh.']);
        }

        CreateBackupJob::dispatch($staff->id, Backup::TYPE_MANUAL);

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Backup started. Refresh to see its status.');
    }

    /** Status polling for long-running ops (JSON, staff-only). */
    public function show(Request $request, Backup $backup)
    {
        $this->ensureStaff($request->user());

        return response()->json([
            'id' => $backup->id,
            'status' => $backup->status,
            'type' => $backup->type,
            'size_bytes' => $backup->size_bytes,
            'checksum_sha256' => $backup->checksum_sha256,
            'error_message' => $backup->error_message,
            'created_at' => $backup->created_at?->toIso8601String(),
            'completed_at' => $backup->completed_at?->toIso8601String(),
        ], 200, ['Cache-Control' => 'private, no-store']);
    }

    /** Stream the archive (staff-only, never a public URL). */
    public function download(Request $request, Backup $backup)
    {
        $this->ensureStaff($request->user());

        if (! Storage::disk($backup->disk)->exists($backup->filename)) {
            abort(404);
        }

        $absolute = Storage::disk($backup->disk)->path($backup->filename);

        // BinaryFileResponse defaults to `public`; force private so the
        // archive is never cached by shared caches (scope §16).
        $response = response()->download($absolute, 'backup-'.$backup->id.'-'.$backup->created_at?->format('Ymd-His').'.zip', [
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    public function destroy(Request $request, Backup $backup)
    {
        $this->ensureStaff($request->user());

        try {
            BackupManager::deleteBackup($backup, $request->user());
        } catch (ValidationException $e) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors($e->errors());
        }

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Backup deleted.');
    }

    /**
     * Destructive restore. Requires explicit confirmation fields:
     * `confirm=1` + `acknowledge=1` plus the backup id echo. Without all
     * three nothing runs and current data is untouched.
     */
    public function restore(Request $request, Backup $backup)
    {
        $this->ensureStaff($request->user());

        $confirmed = $request->boolean('confirm')
            && $request->boolean('acknowledge')
            && (string) $request->input('backup_id') === (string) $backup->id;

        try {
            $restored = BackupManager::restoreBackup($backup, $request->user(), $confirmed);
        } catch (ValidationException $e) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors($e->errors());
        }

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Backup #'.$restored->id.' restored. A verified pre-restore recovery point was kept.');
    }

    /** Queue a restore (same confirmation + verified path). */
    public function dispatchRestore(Request $request, Backup $backup)
    {
        $this->ensureStaff($request->user());

        $confirmed = $request->boolean('confirm')
            && $request->boolean('acknowledge')
            && (string) $request->input('backup_id') === (string) $backup->id;

        if (! $confirmed) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors(['restore' => 'Restoring replaces all current data. Tick the confirmation and try again.']);
        }

        RestoreBackupJob::dispatch($backup->id, $request->user()->id);

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Restore started. Refresh to see its status.');
    }

    /** Upload an archive (validated before it ever lands in backups/). */
    public function upload(Request $request)
    {
        $this->ensureStaff($request->user());

        $request->validate([
            'backup' => ['required', 'file', 'max:524288'],
        ]);

        try {
            $backup = BackupManager::uploadBackup($request->file('backup'), $request->user());
        } catch (ValidationException $e) {
            return redirect()->route('filament.admin.pages.backups')
                ->withErrors($e->errors());
        }

        return redirect()->route('filament.admin.pages.backups')
            ->with('status', 'Backup #'.$backup->id.' uploaded and verified.');
    }

    private function ensureStaff($user): void
    {
        if ($user === null || ! $user->is_staff || $user->disabled_at !== null) {
            abort(403);
        }
    }

    private function humanBytes(int $bytes): string
    {
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, 1).' '.$unit;
            }
            $bytes /= 1024;
        }

        return round($bytes, 1).' GB';
    }
}
