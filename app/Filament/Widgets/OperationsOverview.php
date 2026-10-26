<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\PaymentRequests\PaymentRequestResource;
use App\Models\Lesson;
use App\Models\PaymentRequest;
use App\Models\Subscription;
use App\Models\Topic;
use App\Support\Entitlement;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/**
 * Minimal operations dashboard (scope excludes chart dashboards; this is
 * just the counts a small owner needs on opening the panel).
 */
class OperationsOverview extends StatsOverviewWidget
{
    protected static ?int $sort = -1;

    protected function getStats(): array
    {
        $pending = PaymentRequest::query()
            ->where('status', PaymentRequest::STATUS_PENDING)
            ->count();

        $open = PaymentRequest::query()
            ->whereIn('status', PaymentRequest::OPEN_STATUSES)
            ->count();

        $activeSubscriptions = Subscription::query()
            ->whereNull('revoked_at')
            ->where('starts_at', '<=', now())
            ->where('expires_at', '>', now())
            ->count();

        $publishedTopics = Topic::query()->where('status', 'published')->count();
        $publishedLessons = Lesson::query()->where('status', 'published')->count();

        return [
            Stat::make('Pending payments', (string) $pending)
                ->description($open.' open request'.($open === 1 ? '' : 's'))
                ->color($pending > 0 ? 'warning' : 'success'),
            Stat::make('Active subscriptions', (string) $activeSubscriptions)
                ->description('Current, not revoked, inside the window')
                ->color('success'),
            Stat::make('Published content', $publishedTopics.' topics / '.$publishedLessons.' lessons')
                ->description('Visible in the learner app')
                ->color('info'),
            Stat::make('Payment queue', 'Open')
                ->description('Review pending requests')
                ->url(PaymentRequestResource::getUrl('index'))
                ->color('gray'),
        ];
    }

    public static function canView(): bool
    {
        return Entitlement::staff(auth()->user());
    }
}
