<?php

namespace App\Providers\Filament;

use App\Filament\Widgets\OperationsOverview;
use App\Http\Middleware\PrivateNoStore;
use App\Http\Middleware\RejectDisabledUsers;
use App\Http\Middleware\RequireStaffTwoFactor;
use App\Http\Middleware\SetStaffLocale;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets\AccountWidget;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            // Custom admin theme: the default Filament theme does not scan
            // app Blade views, so the custom pages' utility classes were
            // missing (narrow textareas, collapsed spacing).
            ->viteTheme('resources/css/filament/admin/theme.css')
            // Filament routes are outside the web middleware group, so
            // the staff English locale boundary must be attached here.
            ->middleware([SetStaffLocale::class], isPersistent: true)
            ->login()
            ->colors([
                'primary' => Color::Amber,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->widgets([
                AccountWidget::class,
                OperationsOverview::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
                // S8-4: panel routes never reach the global web group, so
                // panel HTML (including /admin/login) gets the same
                // private/no-store + noindex discipline here.
                PrivateNoStore::class,
            ])
            ->authMiddleware([
                Authenticate::class,
                RejectDisabledUsers::class,
                // S8 staff session gate (scope §5): TOTP enforcement +
                // idle timeout. Order matters: identity first, then gate.
                // Persistent so Livewire updates on an open panel page
                // re-check the same gate (an idle/stale session cannot keep
                // approving or editing after the page loaded).
                RequireStaffTwoFactor::class,
            ], isPersistent: true);
    }
}
