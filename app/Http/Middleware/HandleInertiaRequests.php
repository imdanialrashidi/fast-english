<?php

namespace App\Http\Middleware;

use App\Models\Lesson;
use App\Models\VocabularyWord;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            // M0 foundation: the only props every Inertia page may assume.
            // The authenticated user is an allowlist (id/name/email) — never
            // password hashes, tokens, or internal flags. Flash messages are
            // set by controllers with ->with('success'|'error', ...).
            // Session access is guarded: the error-page renderer resolves
            // this middleware for sessionless paths too (missing favicons,
            // unsigned /storage probes), where user()/session() must stay null.
            'auth' => [
                'user' => $request->hasSession() && $request->user()
                    ? $request->user()->only(['id', 'name', 'email'])
                    : null,
            ],
            'flash' => [
                'success' => fn () => ($request->hasSession() ? $request->session()->get('success') : null),
                'error' => fn () => ($request->hasSession() ? $request->session()->get('error') : null),
            ],
            // Public slice (auth reset + settings + placement): Fortify and
            // the settings/placement controllers flash neutral `status`
            // strings (never secrets). Pages read this prop instead of
            // the Blade session helper; null when no status was flashed.
            'status' => fn () => ($request->hasSession() ? $request->session()->get('status') : null),
            // The only badge the tab bar shows: the learner's due word count.
            // A count only, scoped server-side to the session user; guests and
            // staff without words get 0. Refreshed by the same partial reload
            // that refreshes the notebook.
            'due_words' => fn () => $request->hasSession() && $request->user() !== null
                ? (int) VocabularyWord::query()
                    ->where('user_id', $request->user()->id)
                    ->where('status', 'learning')
                    ->where('due_at', '<=', now())
                    ->count()
                : 0,
            // Public marketing/auth surfaces need to know whether a real
            // sample exists before offering a «شروع با نمونه رایگان» link;
            // /sample is a 404 until content is uploaded. Learner routes are
            // excluded so their fixed query budgets stay untouched.
            'has_public_sample' => fn (): bool => $this->publicSampleAvailable($request),
        ];
    }

    private function publicSampleAvailable(Request $request): bool
    {
        if (! $request->routeIs(
            'landing',
            'sample',
            'download',
            'install',
            'trust.*',
            'login',
            'register',
            'password.*',
            'verification.*',
        )) {
            return false;
        }

        return Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->exists();
    }
}
