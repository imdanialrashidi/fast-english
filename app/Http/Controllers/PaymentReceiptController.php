<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\PaymentRequest;
use App\Support\ReceiptImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Response;

/**
 * S5 receipt intake + private delivery (scope §10.3, §16).
 *
 * Submit (awaiting_receipt → pending):
 * - Optional transfer details (tracking code, transfer time, last four
 *   digits of the source card) plus one required receipt image. CVV2,
 *   PIN, expiry, the full source number, and card images are never
 *   collected — no such field exists here.
 * - Validation: JPEG/PNG/WebP, ≤5 MB, MIME + signature + decode test,
 *   ≤6000×6000 px. SVG, HTML, PDF, and executables are 422 with no file
 *   stored and no row change.
 * - Storage: re-encoded (metadata stripped) under a random name on the
 *   private disk. The public disk never holds a receipt.
 * - Order: the file is written before the DB mutation. On a failed DB
 *   write the file is removed. Orphaned files are reclaimed by the
 *   `receipts:cleanup` command. Success is shown only after the commit.
 * - Idempotency: a retry after a timeout returns the same pending request
 *   and creates no new row. A concurrent double submit leaves one pending
 *   row; the loser's file is removed immediately.
 *
 * Delivery: the owner — and only the owner — may fetch the receipt bytes.
 * Another student gets 403. Staff web access is deferred to the S6 panel;
 * no staff review/approve/reject action is built here. The response is
 * private, no-store, and the route stays out of every SW/CDN cache.
 */
class PaymentReceiptController extends Controller
{
    public function store(Request $request, PaymentRequest $paymentRequest)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (Gate::allows('view', $paymentRequest) !== true) {
            abort(403);
        }

        $paymentRequest->refresh();

        // Idempotent retry: an already-pending request is returned as-is.
        // No new file is required and no new row is created.
        if ($paymentRequest->status === PaymentRequest::STATUS_PENDING) {
            if ($request->expectsJson()) {
                return response()->json([
                    'id' => $paymentRequest->id,
                    'status' => $paymentRequest->status,
                ])->withHeaders(NoStore::headers());
            }

            return redirect()->route('payments.show', $paymentRequest);
        }

        if ($paymentRequest->status !== PaymentRequest::STATUS_AWAITING_RECEIPT) {
            abort(403);
        }

        $data = $request->validate([
            'bank_reference' => ['nullable', 'string', 'max:64'],
            'sender_last4' => ['nullable', 'string', 'regex:/^[0-9]{4}$/'],
            'transferred_at' => ['nullable', 'date', 'before_or_equal:now'],
            'receipt' => ['required', 'file', 'max:5120'],
        ], [
            'bank_reference.max' => 'کد پیگیری حداکثر ۶۴ نویسه است.',
            'sender_last4.regex' => 'چهار رقم آخر کارت باید دقیقاً ۴ رقم باشد.',
            'transferred_at.date' => 'زمان انتقال معتبر نیست.',
            'transferred_at.before_or_equal' => 'زمان انتقال نمی‌تواند در آینده باشد.',
            'receipt.required' => 'تصویر رسید الزامی است.',
            'receipt.file' => 'رسید باید یک فایل معتبر باشد.',
            'receipt.max' => 'حجم رسید نباید بیشتر از ۵ مگابایت باشد.',
        ]);

        /** @var UploadedFile $uploaded */
        $uploaded = $request->file('receipt');

        $problem = ReceiptImage::problem($uploaded);
        if ($problem !== null) {
            throw ValidationException::withMessages([
                'receipt' => 'رسید نامعتبر است: '.$problem,
            ]);
        }

        // File first, then the DB change (scope §10.3).
        $storedPath = ReceiptImage::store($uploaded);

        try {
            $outcome = DB::transaction(function () use ($paymentRequest, $data, $storedPath) {
                $row = PaymentRequest::where('id', $paymentRequest->id)->lockForUpdate()->firstOrFail();

                // Lost the race: another submit already moved this request
                // to pending — our file is orphaned.
                if ($row->status === PaymentRequest::STATUS_PENDING) {
                    return ['row' => $row, 'won' => false];
                }

                if ($row->status !== PaymentRequest::STATUS_AWAITING_RECEIPT) {
                    abort(403);
                }

                $previous = $row->receipt_path;
                $row->forceFill([
                    'receipt_path' => $storedPath,
                    'bank_reference' => $data['bank_reference'] ?? null,
                    'sender_last4' => $data['sender_last4'] ?? null,
                    'transferred_at' => $data['transferred_at'] ?? null,
                    'status' => PaymentRequest::STATUS_PENDING,
                ])->save();

                if (is_string($previous) && $previous !== '' && $previous !== $storedPath) {
                    Storage::disk('local')->delete($previous);
                }

                return ['row' => $row, 'won' => true];
            });
        } catch (\Throwable $e) {
            // Compensating delete: the DB change failed, so the file we
            // just wrote must not linger.
            Storage::disk('local')->delete($storedPath);
            throw $e;
        }

        // A lost submit race leaves our file unreferenced — remove it now.
        if ($outcome['won'] === false) {
            Storage::disk('local')->delete($storedPath);
        }

        $fresh = $outcome['row']->fresh();

        if ($request->expectsJson()) {
            return response()->json([
                'id' => $fresh->id,
                'status' => $fresh->status,
            ])->withHeaders(NoStore::headers());
        }

        return redirect()
            ->route('payments.show', $fresh)
            ->with('status', 'رسید ثبت شد و در صف بررسی قرار گرفت.');
    }

    public function show(Request $request, PaymentRequest $paymentRequest): Response
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (Gate::allows('viewReceipt', $paymentRequest) !== true) {
            abort(403);
        }

        // S8 retention (scope §19.3): a retained receipt keeps its row
        // but its bytes are gone — serve 404, never a stale path error.
        if ($paymentRequest->receipt_deleted_at !== null) {
            abort(404);
        }

        $path = (string) $paymentRequest->receipt_path;
        $absolute = Storage::disk('local')->path($path);
        if ($path === '' || ! is_file($absolute)) {
            abort(404);
        }

        // S9a production (scope §16): policy first, then nginx serves the
        // bytes via X-Accel-Redirect from the internal location. Dev and
        // tests keep the PHP file response; covers stay on the public disk
        // and are never served here.
        if (app()->environment('production')) {
            return response('', 200, [
                'X-Accel-Redirect' => '/_private/'.$path,
                'Content-Type' => $this->contentType($absolute),
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'private, no-store',
            ]);
        }

        $response = response()->file($absolute, [
            'Content-Type' => $this->contentType($absolute),
        ]);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }

    private function contentType(string $absolute): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($absolute);

        return in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)
            ? $mime
            : 'application/octet-stream';
    }
}
