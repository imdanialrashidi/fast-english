<?php

namespace App\Filament\Resources\PaymentRequests\Pages;

use App\Filament\Resources\PaymentRequests\PaymentRequestResource;
use App\Filament\Resources\PaymentRequests\PaymentReviewActions;
use Filament\Resources\Pages\ViewRecord;

class ViewPaymentRequest extends ViewRecord
{
    protected static string $resource = PaymentRequestResource::class;

    public function getTitle(): string
    {
        $record = $this->getRecord();

        return 'Payment #'.$record->id.' — '.($record->user?->email ?? 'unknown learner');
    }

    protected function getHeaderActions(): array
    {
        return [
            PaymentReviewActions::approve(),
            PaymentReviewActions::reject(),
            PaymentReviewActions::cancel(),
            PaymentReviewActions::grant(),
            PaymentReviewActions::revoke(),
        ];
    }
}
