<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\BookmarkController;
use App\Http\Controllers\BookUnitController;
use App\Http\Controllers\DataTransferController;
use App\Http\Controllers\DownloadController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\ExerciseController;
use App\Http\Controllers\FlashcardBookController;
use App\Http\Controllers\FlashcardMediaController;
use App\Http\Controllers\FlashcardReviewController;
use App\Http\Controllers\FlashcardUnitController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\LessonAudioController;
use App\Http\Controllers\LessonFlashcardController;
use App\Http\Controllers\LessonProgressController;
use App\Http\Controllers\PaymentReceiptController;
use App\Http\Controllers\PaymentRequestController;
use App\Http\Controllers\PhoneLoginController;
use App\Http\Controllers\PhoneVerificationController;
use App\Http\Controllers\PlacementController;
use App\Http\Controllers\PwaController;
use App\Http\Controllers\ReviewController;
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

// Owner request (2026-11-12): phone login by a six-digit SMS code. The
// guest routes issue and consume a hashed code; the auth routes finish the
// phone check for registration or an account-settings change. The
// verification gate allows both groups so a half-verified account can
// complete the flow without a redirect loop.
Route::middleware('guest')->group(function () {
    Route::get('/login/code', [PhoneLoginController::class, 'show'])->name('phone.login');
    Route::post('/login/code', [PhoneLoginController::class, 'send'])
        ->middleware('throttle:5,1')
        ->name('phone.login.send');
    Route::get('/login/code/verify', [PhoneLoginController::class, 'verifyForm'])->name('phone.login.verify');
    Route::post('/login/code/verify', [PhoneLoginController::class, 'verify'])
        ->middleware('throttle:10,1')
        ->name('phone.login.verify.store');
    Route::post('/login/code/resend', [PhoneLoginController::class, 'resend'])
        ->middleware('throttle:3,1')
        ->name('phone.login.resend');
});

Route::middleware('auth')->group(function () {
    Route::get('/phone/verify', [PhoneVerificationController::class, 'notice'])->name('phone.notice');
    Route::post('/phone/verify', [PhoneVerificationController::class, 'verify'])
        ->middleware('throttle:12,1')
        ->name('phone.verify');
    Route::post('/phone/verify/resend', [PhoneVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')
        ->name('phone.send');
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

// S8: /plans is a public price entry (scope §6). Guests land on the plan
// section of the public pricing page; a signed-in learner goes straight to
// the authenticated checkout list. The old unconditional redirect sent
// guests to an auth-only route and then to the login screen.
Route::get('/plans', function () {
    if (auth()->check()) {
        return redirect()->route('subscribe.index');
    }

    return redirect()->to(route('landing').'#plans');
})->name('plans');

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

// Cross-track review hub (owner request 2026-11-15): due words, due book
// cards and exercise mistakes in one read-only page. Each queue keeps its
// own session; the hub only links.
Route::get('/app/review', [ReviewController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('review.index');

// Books section (owner request 2026-11-15): the shelf, one book, and the
// unit hub. A unit has two real paths — flashcards and exercises — so the
// hub is the unit's home and the player is a child route. Deep links from
// the pre-books URLs are redirected at the bottom of this block.
Route::get('/app/books', [FlashcardBookController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('flashcards.index');
Route::get('/app/books/{book:slug}', [FlashcardBookController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('flashcards.book');
Route::get('/app/books/{book:slug}/{unit}', [BookUnitController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('unit')
    ->name('books.unit');
Route::get('/app/books/{book:slug}/{unit}/flashcards', [FlashcardUnitController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('unit')
    ->name('flashcards.unit');
Route::get('/app/books/{book:slug}/{unit}/flashcards/results', [FlashcardUnitController::class, 'results'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('unit')
    ->name('flashcards.results');

// Book-unit exercises (owner request 2026-11-16): grammar topics and
// questions live on the unit page, and one question is marked in place.
// The first answer is stored and counted; a retry returns the same result.
Route::post('/app/books/{book:slug}/{unit}/exercises/answer', [ExerciseController::class, 'answer'])
    ->middleware(['auth', 'reject.disabled', 'subscribed', 'throttle:120,1'])
    ->whereNumber('unit')
    ->name('exercises.answer');

// The old session URLs stay as redirects: the unit page is the session now.
Route::get('/app/books/{book:slug}/{unit}/exercises', fn (string $book, string $unit) => redirect()->route('books.unit', ['book' => $book, 'unit' => $unit]))
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('unit');
Route::get('/app/books/{book:slug}/{unit}/exercises/{attempt}', fn (string $book, string $unit, string $attempt) => redirect()->route('books.unit', ['book' => $book, 'unit' => $unit]))
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('unit')
    ->whereNumber('attempt');

// The daily card queue and the idempotent card review write are card-level
// surfaces, not a book path; they keep their existing URLs (the future
// «مرور» tab will host them).
Route::get('/app/flashcards/review', [FlashcardReviewController::class, 'index'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('flashcards.review');
Route::post('/app/flashcards/reviews', [FlashcardReviewController::class, 'store'])
    ->middleware(['auth', 'reject.disabled', 'subscribed', 'throttle:120,1'])
    ->name('flashcards.reviews.store');

// Legacy deep links → the books section.
Route::redirect('/app/flashcards', '/app/books');
Route::get('/app/flashcards/{book:slug}', fn (string $book) => redirect()->route('flashcards.book', ['book' => $book]));
Route::get('/app/flashcards/{book:slug}/{unit}', fn (string $book, string $unit) => redirect()->route('books.unit', ['book' => $book, 'unit' => $unit]))
    ->whereNumber('unit');
Route::get('/app/flashcards/{book:slug}/{unit}/results', fn (string $book, string $unit) => redirect()->route('flashcards.results', ['book' => $book, 'unit' => $unit]))
    ->whereNumber('unit');
Route::get('/app/flashcards/{book:slug}/{unit}/exercises', fn (string $book, string $unit) => redirect()->route('books.unit', ['book' => $book, 'unit' => $unit]))
    ->whereNumber('unit');
Route::get('/app/flashcards/{book:slug}/{unit}/exercises/{attempt}', fn (string $book, string $unit, string $attempt) => redirect()->route('books.unit', ['book' => $book, 'unit' => $unit]))
    ->whereNumber('unit')
    ->whereNumber('attempt');

// One lesson's vocabulary deck (owner clarification 2026-11-15): the
// lesson glossary is the deck, with the vocabulary notebook's four-grade
// schedule. The lesson id is the reader's own lesson row; the controller
// re-checks publication and the route carries the paid gate.
Route::get('/app/lessons/{lesson}/flashcards', [LessonFlashcardController::class, 'show'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('lesson')
    ->name('lessons.flashcards');
Route::post('/app/lessons/{lesson}/flashcards/reviews', [LessonFlashcardController::class, 'store'])
    ->middleware(['auth', 'reject.disabled', 'subscribed', 'throttle:120,1'])
    ->whereNumber('lesson')
    ->name('lessons.flashcards.store');

Route::get('/media/flashcards/{flashcard}/audio', [FlashcardMediaController::class, 'audio'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('flashcard')
    ->name('media.flashcard.audio');
Route::get('/media/words/{wordAudio}/audio', [FlashcardMediaController::class, 'word'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->whereNumber('wordAudio')
    ->name('media.word.audio');
Route::get('/media/flashcard-books/{book:slug}/cover', [FlashcardMediaController::class, 'cover'])
    ->middleware(['auth', 'reject.disabled', 'subscribed'])
    ->name('media.flashcard.cover');

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
