<?php

namespace App\Http\Controllers;

use App\Support\DataTransfer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Staff-only import/export of the whole installation (OPS-01).
 *
 * Replaces the earlier stored-archive backup/restore subsystem: there is
 * no archive list, no job, no lifecycle table. Export streams one ZIP the
 * owner keeps; import validates a ZIP and replaces the live data.
 *
 * Both actions sit behind `auth` + `staff` (routes) and re-check the staff
 * flag here. Responses are private/no-store; the archive contains personal
 * data (users, receipts) and must never be publicly reachable.
 */
class DataTransferController extends Controller
{
    /** Stream a fresh export. */
    public function export(Request $request): BinaryFileResponse|RedirectResponse
    {
        $this->ensureStaff($request->user());

        Storage::disk('local')->makeDirectory('tmp');
        $name = 'fast-english-export-'.now()->format('Ymd-His').'.zip';
        $absolute = Storage::disk('local')->path('tmp/'.$name);

        try {
            DataTransfer::exportTo($absolute);
        } catch (\Throwable $e) {
            @unlink($absolute);
            report($e);

            return $this->back()->withErrors([
                'export' => 'The export could not be created. Nothing was changed; check the log for details.',
            ]);
        }

        return $this->download($absolute, $name);
    }

    /** Validate an uploaded archive, keep a safety copy, replace data. */
    public function import(Request $request): RedirectResponse
    {
        $this->ensureStaff($request->user());

        $request->validate([
            'archive' => ['required', 'file', 'max:'.DataTransfer::MAX_UPLOAD_KILOBYTES],
            'confirm' => ['accepted'],
        ], [
            'archive.required' => 'Choose a ZIP archive exported from this panel.',
            'archive.file' => 'The upload did not arrive as a file.',
            'archive.max' => 'The archive is larger than 512 MB.',
            'confirm.accepted' => 'Tick the confirmation box: importing replaces all current data.',
        ]);

        $lock = Cache::lock('data-transfer:import', 600);
        if (! $lock->get()) {
            return $this->back()->withErrors(['archive' => 'Another import is already running.']);
        }

        $path = null;

        try {
            $stored = $request->file('archive')->storeAs(
                'tmp',
                'import-'.strtolower((string) Str::ulid()).'.zip',
                'local'
            );

            if ($stored === false) {
                throw new \RuntimeException('The uploaded archive could not be stored.');
            }

            $path = Storage::disk('local')->path($stored);

            $manifest = DataTransfer::validateArchive($path);

            // Point of no return: keep the current state first.
            DataTransfer::createSafetyCopy();

            $stats = DataTransfer::applyArchive($path, $manifest);
        } catch (ValidationException $e) {
            return $this->back()->withErrors($e->errors());
        } catch (\Throwable $e) {
            report($e);

            return $this->back()->withErrors([
                'archive' => 'The import failed. The pre-import safety copy is kept; review the log before retrying.',
            ]);
        } finally {
            if (is_string($path)) {
                @unlink($path);
            }
            $lock->release();
        }

        $rows = array_sum($stats['tables']);
        $summary = $rows.' rows and '.$stats['files'].' files imported';

        return $this->back()->with('status', $summary.'. A pre-import safety copy is kept for undo.');
    }

    /** Download the newest pre-import safety copy (undo source). */
    public function safety(Request $request): BinaryFileResponse|RedirectResponse
    {
        $this->ensureStaff($request->user());

        $absolute = DataTransfer::latestSafetyCopy();
        if ($absolute === null || ! is_file($absolute)) {
            return $this->back()->withErrors(['safety' => 'No pre-import safety copy exists yet.']);
        }

        return $this->download($absolute, basename($absolute));
    }

    private function download(string $absolute, string $name): BinaryFileResponse
    {
        $response = response()->download($absolute, $name, [
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    private function back(): RedirectResponse
    {
        return redirect()->route('filament.admin.pages.data-transfer');
    }

    private function ensureStaff($user): void
    {
        if ($user === null || ! $user->is_staff || $user->disabled_at !== null) {
            abort(403);
        }
    }
}
