<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locale boundary: the learner/public product is Persian, while the
 * Filament staff panel keeps its English UI (and English framework
 * validation copy). Filament has no per-panel locale API in v5, so this
 * middleware pins the locale for staff paths.
 *
 * Livewire update requests arrive on /livewire/update rather than the
 * page URL; the referer keeps an admin-page interaction in English too.
 */
class SetStaffLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $referer = (string) $request->headers->get('referer', '');

        if (
            $request->is('admin', 'admin/*', 'staff', 'staff/*')
            || str_contains($referer, '/admin')
            || str_contains($referer, '/staff/')
        ) {
            App::setLocale('en');
        }

        return $next($request);
    }
}
