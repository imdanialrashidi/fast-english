<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\BookmarkController;
use App\Http\Controllers\DownloadController;
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

// Owner requirement (2026-10-21): the landing system is a guest-only
// marketing surface for search and download. Signed-in learners never
// see the public shell; middleware sends them back into /app. The public
// sample stays outside this group because the in-app locked state links
// to it as the free path.
Route::middleware('marketing.guest')->group(function () {
    // S8 landing (scope §6, PUB-01): short Persian page with the promise,
    // the real sample link, how it works, the DB plan list, install and
    // download links, and the FAQ link.
    Route::get('/', [LandingController::class, 'index'])->name('landing');

    // S8 trust pages (scope §6, PUB-02): draft copy labelled as draft;
    // support/terms/privacy show explicit BLOCKED states (scope §25).
    Route::get('/about', [TrustController::class, 'about'])->name('trust.about');
    Route::get('/cooperation', [TrustController::class, 'cooperation'])->name('trust.cooperation');
    Route::get('/faq', [TrustController::class, 'faq'])->name('trust.faq');
    Route::get('/support', [TrustController::class, 'support'])->name('trust.support');
    Route::get('/terms', [TrustController::class, 'terms'])->name('trust.terms');
    Route::get('/privacy', [TrustController::class, 'privacy'])->name('trust.privacy');

    // S8 download page (scope §18.2): «هنوز منتشر نشده» until a real build
    // fills the release metadata. /install redirects here (scope §6).
    Route::get('/download', [DownloadController::class, 'index'])->name('download');
    Route::redirect('/install', '/download', 302)->name('install');
});

// Public sample entry (scope §6, PUB-01/AC-01): the real published sample
// without login. Drafts/premium never resolve here; 404 when none exists.
Route::get('/sample', [LandingController::class, 'sample'])->name('sample');

// S8: /plans is an alias for the subscribe page (scope §6).
Route::redirect('/plans', '/app/subscribe', 302)->name('plans');

// S8 sitemap (scope §19.1): public marketing pages only.
Route::get('/sitemap.xml', [SitemapController::class, 'index'])->name('sitemap');

// S8 staff TOTP (scope §5): staff-only (403 for students). The challenge
// POSTs carry a tight throttle: six-digit codes must not be guessable.
Route::middleware(['auth', 'staff'])->group(function () {
    Route::get('/staff/two-factor', [StaffTwoFactorController::class, 'setup'])->name('staff.twofactor.setup');
    Route::post('/staff/two-factor', [StaffTwoFactorController::class, 'start'])->name('staff.twofactor.start');
    Route::post('/staff/two-factor/confirm', [StaffTwoFactorController::class, 'confirm'])->middleware('throttle:10,1')->name('staff.twofactor.confirm');
    Route::get('/staff/two-factor/challenge', [StaffTwoFactorController::class, 'challenge'])->name('staff.twofactor.challenge');
    Route::post('/staff/two-factor/challenge', [StaffTwoFactorController::class, 'verifyChallenge'])->middleware('throttle:10,1')->name('staff.twofactor.verify');
    Route::post('/staff/two-factor/disable', [StaffTwoFactorController::class, 'disable'])->name('staff.twofactor.disable');
    // S8 placement management (scope §5): publish through the same shared
    // action the placement:publish CLI uses.
    Route::post('/staff/placement/{test}/publish', [StaffPlacementController::class, 'publish'])->name('staff.placement.publish');
    // Panel-based one-click backup & restore (OPS-01): staff-only,
    // private no-store. The Filament Backups page posts here so every
    // destructive step has an HTTP-testable server-side boundary.
    Route::post('/staff/backups', [BackupController::class, 'store'])->middleware('throttle:6,1')->name('staff.backups.store');
    Route::post('/staff/backups/upload', [BackupController::class, 'upload'])->middleware('throttle:6,1')->name('staff.backups.upload');
    Route::get('/staff/backups/{backup}', [BackupController::class, 'show'])->name('staff.backups.status');
    Route::get('/staff/backups/{backup}/download', [BackupController::class, 'download'])->name('staff.backups.download');
    Route::delete('/staff/backups/{backup}', [BackupController::class, 'destroy'])->name('staff.backups.destroy');
    Route::post('/staff/backups/{backup}/restore', [BackupController::class, 'restore'])->middleware('throttle:6,1')->name('staff.backups.restore');
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
    ->middleware(['auth', 'reject.disabled'])
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
