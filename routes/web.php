<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\BookmarkController;
use App\Http\Controllers\DataTransferController;
use App\Http\Controllers\DownloadController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\LessonAudioController;
use App\Http\Controllers\LessonProgressController;
use App\Http\Controllers\PaymentReceiptController;
use App\Http\Controllers\PaymentRequestController;
use App\Http\Controllers\PlacementController;
use App\Http\Controllers\PwaController;
use App\Http\Controllers\SavedTopicsController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\StaffPlacementController;
use App\Http\Controllers\StaffTwoFactorController;
use App\Http\Controllers\SubscribeController;
use App\Http\Controllers\TodayController;
use App\Http\Controllers\TopicLibraryController;
use App\Http\Controllers\TopicReaderController;
use App\Http\Controllers\TrustController;
use App\Http\Controllers\VocabularyController;
use Illuminate\Support\Facades\Route;

// Owner request (2026-10-28): a new account receives a six-digit code by
// email and must enter it before the learner surface opens. These routes
// are outside marketing.guest (a signed-in account reaches them) and the
// verification gate allows them so there is no redirect loop.
Route::middleware('auth')->group(function () {
    Route::get('/email/verify', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::post('/email/verify', [EmailVerificationController::class, 'verify'])
        ->middleware('throttle:12,1')
        ->name('verification.verify');
    Route::post('/email/verify/resend', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')
        ->name('verification.send');
});

// Owner requirement (2026-10-21): the landing/trust marketing surface is
// guest-only. Signed-in learners never see the public shell; middleware
// sends them back into /app. The public sample, install guide, and the
// download page stay outside this group: the in-app locked state links to
// the sample, and a signed-in learner who wants the APK must not be sent
// to the paywall.
Route::middleware('marketing.guest')->group(function () {
    // S8 landing (scope §6, PUB-01): short Persian page with the promise,
    // the real sample link, how it works, the DB plan list, install and
    // download links, and the FAQ link.
    Route::get('/', [LandingController::class, 'index'])->name('landing');

    // S8 trust pages (scope §6, PUB-02): public Persian copy. Contact
    // channels and legal text are owner-editable settings; missing values
    // fall back to a calm public note (never DRAFT/BLOCKED labels).
    Route::get('/about', [TrustController::class, 'about'])->name('trust.about');
    Route::get('/cooperation', [TrustController::class, 'cooperation'])->name('trust.cooperation');
    Route::get('/faq', [TrustController::class, 'faq'])->name('trust.faq');
    Route::get('/support', [TrustController::class, 'support'])->name('trust.support');
    Route::get('/terms', [TrustController::class, 'terms'])->name('trust.terms');
    Route::get('/privacy', [TrustController::class, 'privacy'])->name('trust.privacy');
    Route::get('/refund', [TrustController::class, 'refund'])->name('trust.refund');
});

// Install guide (owner 2026-10-26): public for guests and signed-in
// learners. iPhone Safari never fires `beforeinstallprompt`, and the
// Account screen links here, so it stays outside marketing.guest.
Route::get('/install', [InstallController::class, 'index'])->name('install');

// Download page: public for guests AND signed-in learners (2026-10-28).
// A learner who wants the APK must not be bounced to the paid app by the
// marketing.guest boundary; the page exposes release metadata only.
Route::get('/download', [DownloadController::class, 'index'])->name('download');

// Public sample entry (scope §6, PUB-01/AC-01): the real published sample
// without login. Drafts/premium never resolve here; 404 when none exists.
Route::get('/sample', [LandingController::class, 'sample'])->name('sample');

// S8: /plans is an alias for the subscribe page (scope §6).
Route::redirect('/plans', '/app/subscribe', 302)->name('plans');

// S8 sitemap (scope §19.1): public marketing pages only.
Route::get('/sitemap.xml', [SitemapController::class, 'index'])->name('sitemap');

// S8 staff TOTP (scope §5): staff-only (403 for students). The challenge
// POSTs carry a tight throttle: six-digit codes must not be guessable.
// These setup/challenge routes are deliberately outside the step-up gate;
// everything else under /staff requires a passed staff session.
Route::middleware(['auth', 'staff'])->group(function () {
    Route::get('/staff/two-factor', [StaffTwoFactorController::class, 'setup'])->name('staff.twofactor.setup');
    Route::post('/staff/two-factor', [StaffTwoFactorController::class, 'start'])->name('staff.twofactor.start');
    Route::post('/staff/two-factor/confirm', [StaffTwoFactorController::class, 'confirm'])->middleware('throttle:10,1')->name('staff.twofactor.confirm');
    Route::get('/staff/two-factor/challenge', [StaffTwoFactorController::class, 'challenge'])->name('staff.twofactor.challenge');
    Route::post('/staff/two-factor/challenge', [StaffTwoFactorController::class, 'verifyChallenge'])->middleware('throttle:10,1')->name('staff.twofactor.verify');
    Route::post('/staff/two-factor/disable', [StaffTwoFactorController::class, 'disable'])->name('staff.twofactor.disable');
});

// Privileged staff operations: identity + TOTP/idle gate. These live
// outside the Filament panel, so the panel auth middleware does not cover
// them; without this group a stolen staff password could export the
// database or fetch receipts while 2FA is enforced.
Route::middleware(['auth', 'staff', 'staff.2fa'])->group(function () {
    // S8 placement management (scope §5): publish through the same shared
    // action the placement:publish CLI uses.
    Route::post('/staff/placement/{test}/publish', [StaffPlacementController::class, 'publish'])->name('staff.placement.publish');
    // Panel import/export (OPS-01): staff-only, private no-store. One ZIP
    // out (database + referenced files), one ZIP in (validated, replaces
    // data). The Filament page posts here so the destructive step has an
    // HTTP-testable server-side boundary.
    Route::get('/staff/transfer/export', [DataTransferController::class, 'export'])->middleware('throttle:6,1')->name('staff.transfer.export');
    Route::post('/staff/transfer/import', [DataTransferController::class, 'import'])->middleware('throttle:3,1')->name('staff.transfer.import');
    Route::get('/staff/transfer/safety', [DataTransferController::class, 'safety'])->name('staff.transfer.safety');
    // Staff draft/published audio preview for the panel. Same private
    // bytes/Range contract as the learner route, but no publication gate
    // and an explicit staff step-up.
    Route::get('/staff/lessons/{lesson}/audio', [LessonAudioController::class, 'preview'])->name('staff.lesson.audio');
});

// S2 PWA shell + TWA association (scope §18). The static public/robots.txt
// was removed so this route controls index discipline per environment.
Route::get('/manifest.webmanifest', [PwaController::class, 'manifest'])->name('pwa.manifest');
Route::get('/sw.js', [PwaController::class, 'serviceWorker'])->name('pwa.sw');
Route::get('/offline', [PwaController::class, 'offline'])->name('pwa.offline');
// S3 library (scope §17.2): replaces the S2 /app stub with the real topic
// list. Same path and route name, so the manifest start_url keeps working.
Route::get('/.well-known/assetlinks.json', [PwaController::class, 'assetlinks'])->name('pwa.assetlinks');
Route::get('/robots.txt', [PwaController::class, 'robots'])->name('robots');

// S4 returning user (scope §6, §13): learner account surfaces live in the
// same learner layout as the library/reader so the persistent player
// survives in-app navigation. /account stays as a legacy alias for the S2
// proofs; /app/account is the canonical path.
Route::get('/account', [AccountController::class, 'index'])->middleware(['auth', 'reject.disabled'])->name('account');
Route::get('/app/account', [AccountController::class, 'index'])->middleware(['auth', 'reject.disabled'])->name('app.account');
Route::get('/app/account/settings', [AccountSettingsController::class, 'edit'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('account.settings');
Route::patch('/app/account/settings', [AccountSettingsController::class, 'update'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('account.settings.update');

// Paid-only learner app (owner requirement): library, Today, saved,
// words/review, placement, progress, and bookmarks recompute an active
// subscription per request (`subscribed`, after auth + reject.disabled).
// Staff passes through; account/status/checkout/payment pages stay on
// auth-only so purchasing and status remain reachable without access.
Route::get('/app', [TopicLibraryController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('app.home');

Route::get('/app/saved', [SavedTopicsController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('app.saved');

// R5 Today — «امروز»: the principal signed-in student destination.
Route::get('/app/today', [TodayController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('today.index');

// R4 vocabulary notebook (VOCAB-01): owner-scoped, private no-store.
// The review page is registered before the {word} binding so /review
// never resolves as a word id.
Route::get('/app/words/review', [VocabularyController::class, 'review'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('words.review');
Route::post('/app/words/known', [VocabularyController::class, 'markAllKnown'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('words.known');
Route::get('/app/words', [VocabularyController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('words.index');
Route::post('/app/words', [VocabularyController::class, 'store'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('words.store');
Route::patch('/app/words/{word}', [VocabularyController::class, 'update'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('word')
    ->name('words.update');
Route::delete('/app/words/{word}', [VocabularyController::class, 'destroy'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('word')
    ->name('words.destroy');
Route::post('/app/words/{word}/grade', [VocabularyController::class, 'grade'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('word')
    ->name('words.grade');

// S4 progress + bookmarks (scope §13.2–13.3): authenticated, policy-checked,
// private no-store JSON. The service worker never caches these (POST +
// network-only allowlist), so the S2 cache proofs keep passing.
Route::post('/app/progress', [LessonProgressController::class, 'store'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('progress.store');
Route::post('/app/progress/complete', [LessonProgressController::class, 'complete'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('progress.complete');
Route::post('/app/progress/reset', [LessonProgressController::class, 'reset'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('progress.reset');

Route::post('/app/bookmarks', [BookmarkController::class, 'store'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('bookmarks.store');
Route::delete('/app/bookmarks/{topic}', [BookmarkController::class, 'destroy'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('bookmarks.destroy');

// S1 reader: level travels in the URL (?level=XX), never in stored state.
Route::get('/app/topics/{topic:slug}', [TopicReaderController::class, 'show'])
    ->name('reader.show');

// S1 audio: policy-checked private delivery with HTTP Range support.
Route::get('/media/lessons/{lesson}/audio', [LessonAudioController::class, 'show'])
    ->name('media.lesson.audio');

// S5 payment intake (scope §6–7, §10): snapshot before transfer, private
// receipt, owner-visible status. Pending grants no access (S5-3); approval
// and subscriptions are S6. Every HTML/file response here is private,
// no-store (scope §16); the SW allowlist never caches them (network-only).
Route::get('/app/subscribe', [SubscribeController::class, 'index'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('subscribe.index');
Route::post('/app/payments', [PaymentRequestController::class, 'store'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('payments.store');
Route::get('/app/payments/{paymentRequest}', [PaymentRequestController::class, 'show'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('payments.show');
Route::post('/app/payments/{paymentRequest}/cancel', [PaymentRequestController::class, 'cancel'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('payments.cancel');
Route::post('/app/payments/{paymentRequest}/receipt', [PaymentReceiptController::class, 'store'])
    ->middleware(['auth', 'reject.disabled'])
    ->name('payments.receipt.store');
Route::get('/media/payment-requests/{paymentRequest}/receipt', [PaymentReceiptController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'staff.2fa.if_staff'])
    ->name('payments.receipt.show');

// S7 optional placement (scope §6, §12): pinned attempts, per-question
// saves, server-side marking, explicit accept. Every HTML/JSON response
// here is private, no-store; the SW allowlist never caches them.
Route::get('/app/placement', [PlacementController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('placement.index');
Route::post('/app/placement/start', [PlacementController::class, 'start'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('placement.start');
Route::get('/app/placement/{attempt}', [PlacementController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('attempt')
    ->name('placement.show');
Route::post('/app/placement/{attempt}/answer', [PlacementController::class, 'answer'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('attempt')
    ->name('placement.answer');
Route::post('/app/placement/{attempt}/submit', [PlacementController::class, 'submit'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('attempt')
    ->name('placement.submit');
Route::get('/app/placement/result/{attempt}', [PlacementController::class, 'result'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('attempt')
    ->name('placement.result');
Route::post('/app/placement/{attempt}/accept', [PlacementController::class, 'accept'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('attempt')
    ->name('placement.accept');
