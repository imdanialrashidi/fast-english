<?php

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Resources\PaymentRequests\PaymentReviewActions;
use App\Filament\Resources\Users\UserResource;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Facades\Log;

class ViewUser extends ViewRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            PaymentReviewActions::grant(),
            PaymentReviewActions::revoke()
                ->visible(fn (User $record) => $record->subscription !== null && $record->subscription->revoked_at === null),
            Action::make('suspend')
                ->label('Suspend account')
                ->color('danger')
                ->requiresConfirmation()
                ->modalHeading('Suspend this account?')
                ->modalDescription('The learner or staff member is signed out and every authenticated route refuses until the account is activated again.')
                ->visible(fn (User $record) => $record->disabled_at === null && (int) $record->id !== (int) auth()->id())
                ->form([
                    Textarea::make('reason')
                        ->label('Reason (recorded in the application log)')
                        ->required()
                        ->rows(2),
                ])
                ->action(function (User $record, array $data): void {
                    if ((int) $record->id === (int) auth()->id()) {
                        Notification::make()->danger()->title('You cannot suspend your own account.')->send();

                        return;
                    }

                    $record->forceFill(['disabled_at' => now()])->save();

                    Log::info('staff.user.suspend', [
                        'user_id' => $record->id,
                        'by' => auth()->id(),
                        'reason' => (string) ($data['reason'] ?? ''),
                    ]);

                    Notification::make()->success()->title('Account suspended.')->send();
                }),
            Action::make('activate')
                ->label('Activate account')
                ->color('success')
                ->requiresConfirmation()
                ->modalHeading('Activate this account?')
                ->modalDescription('The account can sign in again. Its subscription window is unchanged.')
                ->visible(fn (User $record) => $record->disabled_at !== null && (int) $record->id !== (int) auth()->id())
                ->form([
                    Textarea::make('reason')
                        ->label('Reason (recorded in the application log)')
                        ->required()
                        ->rows(2),
                ])
                ->action(function (User $record, array $data): void {
                    $record->forceFill(['disabled_at' => null])->save();

                    Log::info('staff.user.activate', [
                        'user_id' => $record->id,
                        'by' => auth()->id(),
                        'reason' => (string) ($data['reason'] ?? ''),
                    ]);

                    Notification::make()->success()->title('Account activated.')->send();
                }),
        ];
    }
}
