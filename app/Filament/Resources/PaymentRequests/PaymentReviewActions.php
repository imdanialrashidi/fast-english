<?php

namespace App\Filament\Resources\PaymentRequests;

use App\Actions\ApprovePayment;
use App\Models\PaymentRequest;
use App\Models\User;
use App\Support\Toman;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Illuminate\Validation\ValidationException;

/**
 * S6 review actions shared by the payment queue table and record page.
 * Each action calls the single shared ApprovePayment action and reports
 * the outcome; no money/access logic lives here (scope §11.2).
 *
 * S7 pre-slice 2: every money/access mutation requires an explicit
 * confirmation step that shows the server snapshot amount, so a single
 * mis-click changes nothing. Each action below uses requiresConfirmation
 * plus a modal description carrying the snapshot amount (Toman::format).
 */
final class PaymentReviewActions
{
    /** @param mixed $record */
    private static function snapshotLine($record): string
    {
        if ($record instanceof PaymentRequest) {
            return $record->snapshotLine();
        }

        return 'Confirm to apply this subscription change.';
    }

    /** @return Action */
    public static function approve()
    {
        return Action::make('approve')
            ->label('Approve')
            ->requiresConfirmation()
            ->modalHeading('Confirm approval')
            ->modalDescription(fn ($record) => self::snapshotLine($record))
            ->visible(fn ($record) => $record !== null && $record->status === PaymentRequest::STATUS_PENDING)
            ->action(function (Action $action, $record) {
                try {
                    $outcome = ApprovePayment::approve($record->id, auth()->user());
                    Notification::make()->success()->title(
                        ($outcome['replayed'] ?? false)
                            ? 'Already approved; no new event.'
                            : 'Approved; subscription extended.'
                    )->send();
                } catch (ValidationException $e) {
                    Notification::make()->danger()->title('Cannot approve.')
                        ->body(collect($e->errors())->flatten()->implode(' '))->send();
                    $action->halt();
                }
            });
    }

    /** @return Action */
    public static function reject()
    {
        return Action::make('reject')
            ->label('Reject')
            ->requiresConfirmation()
            ->modalHeading('Confirm rejection')
            ->modalDescription(fn ($record) => self::snapshotLine($record))
            ->form([
                Textarea::make('public_reason')
                    ->label('Public reason (shown to the learner)')
                    ->required()
                    ->rows(2),
                Textarea::make('internal_note')
                    ->label('Internal note (staff only)')
                    ->rows(2),
            ])
            ->visible(fn ($record) => $record !== null && $record->status === PaymentRequest::STATUS_PENDING)
            ->action(function (Action $action, $record, array $data) {
                try {
                    ApprovePayment::reject($record->id, auth()->user(), (string) ($data['public_reason'] ?? ''), isset($data['internal_note']) ? (string) $data['internal_note'] : null);
                    Notification::make()->success()->title('Rejected.')->send();
                } catch (ValidationException $e) {
                    Notification::make()->danger()->title('Cannot reject.')
                        ->body(collect($e->errors())->flatten()->implode(' '))->send();
                    $action->halt();
                }
            });
    }

    /** @return Action */
    public static function cancel()
    {
        return Action::make('cancel')
            ->label('Cancel')
            ->requiresConfirmation()
            ->modalHeading('Confirm cancellation')
            ->modalDescription(fn ($record) => self::snapshotLine($record))
            ->form([
                Textarea::make('reason')
                    ->label('Reason (required)')
                    ->required()
                    ->rows(2),
            ])
            ->visible(fn ($record) => $record !== null && $record->status === PaymentRequest::STATUS_PENDING)
            ->action(function (Action $action, $record, array $data) {
                try {
                    ApprovePayment::cancel($record->id, auth()->user(), (string) ($data['reason'] ?? ''));
                    Notification::make()->success()->title('Cancelled.')->send();
                } catch (ValidationException $e) {
                    Notification::make()->danger()->title('Cannot cancel.')
                        ->body(collect($e->errors())->flatten()->implode(' '))->send();
                    $action->halt();
                }
            });
    }

    /** @return Action */
    public static function grant()
    {
        return Action::make('grant')
            ->label('Grant subscription')
            ->requiresConfirmation()
            ->modalHeading('Confirm manual grant')
            ->modalDescription(fn ($record) => self::snapshotLine($record))
            ->form([
                TextInput::make('duration_days')
                    ->label('Duration (days)')
                    ->required()
                    ->numeric()
                    ->minValue(1)
                    ->maxValue(3650),
                Textarea::make('reason')
                    ->label('Reason (required, audited)')
                    ->required()
                    ->rows(2),
            ])
            ->action(function (Action $action, $record, array $data) {
                try {
                    $user = $record instanceof User ? $record : $record->user;
                    ApprovePayment::grant((int) $user->id, auth()->user(), (int) ($data['duration_days'] ?? 0), (string) ($data['reason'] ?? ''));
                    Notification::make()->success()->title('Subscription granted.')->send();
                } catch (ValidationException $e) {
                    Notification::make()->danger()->title('Cannot grant.')
                        ->body(collect($e->errors())->flatten()->implode(' '))->send();
                    $action->halt();
                }
            });
    }

    /** @return Action */
    public static function revoke()
    {
        return Action::make('revoke')
            ->label('Revoke subscription')
            ->requiresConfirmation()
            ->modalHeading('Confirm revoke')
            ->modalDescription(fn ($record) => self::snapshotLine($record))
            ->form([
                Textarea::make('reason')
                    ->label('Reason (required, audited; no automatic refund)')
                    ->required()
                    ->rows(2),
            ])
            ->action(function (Action $action, $record, array $data) {
                try {
                    $user = $record instanceof User ? $record : $record->user;
                    ApprovePayment::revoke((int) $user->id, auth()->user(), (string) ($data['reason'] ?? ''));
                    Notification::make()->success()->title('Subscription revoked.')->send();
                } catch (ValidationException $e) {
                    Notification::make()->danger()->title('Cannot revoke.')
                        ->body(collect($e->errors())->flatten()->implode(' '))->send();
                    $action->halt();
                }
            });
    }
}
