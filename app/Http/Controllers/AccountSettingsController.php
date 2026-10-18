<?php

namespace App\Http\Controllers;

use App\Actions\PublishLesson;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S4 level preference (scope §7.2, LEVEL-01): preferred_level changes only
 * through this explicit settings form. Browsing a ?level= URL never writes
 * here (TopicReaderController performs no user writes).
 *
 * Guests keep their selected level as a non-sensitive browser preference
 * (localStorage, no token/receipt/body/answer key — see the React player
 * lib in resources/js/lib/player.tsx).
 * When the preferred level has no lesson for a topic, the reader shows the
 * available levels and never substitutes silently (S1 rule, unchanged).
 */
class AccountSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        // Public-slice Inertia transport (ADR-0002): the same explicit
        // settings form. The retired learner Livewire component's display-
        // name rule lives here now (same required/string/255 server rule);
        // the dark/system appearance radios are gone with the permanent
        // light theme (no theme storage, no theme-choice UI).
        return Inertia::render('Account/Settings', [
            'user' => [
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'preferred_level' => $user->preferred_level,
                'daily_goal_minutes' => (int) ($user->daily_goal_minutes ?? 10),
            ],
            'levels' => PublishLesson::LEVELS,
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            // S0 parity: the display name rule the retired learner
            // Livewire component enforced (required/string/255).
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'preferred_level' => ['nullable', 'in:A1,A2,B1,B2,C1,C2'],
            // R5: the daily goal is an independent explicit choice. It
            // never writes preferred_level and vice versa.
            'daily_goal_minutes' => ['nullable', 'in:5,10,15'],
        ]);

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
        }
        if (array_key_exists('preferred_level', $data)) {
            $updates['preferred_level'] = $data['preferred_level'] ?? null;
        }
        if (array_key_exists('daily_goal_minutes', $data)) {
            $updates['daily_goal_minutes'] = $data['daily_goal_minutes'] !== null
                ? (int) $data['daily_goal_minutes']
                : 10;
        }
        $user->forceFill($updates)->save();

        return redirect()
            ->route('account.settings')
            ->with('status', 'سطح ترجیحی ذخیره شد.');
    }
}
