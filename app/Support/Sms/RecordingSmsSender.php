<?php

namespace App\Support\Sms;

use App\Models\SmsMessage;
use App\Models\User;
use App\Support\PhoneNumber;
use Closure;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Records every attempt around the real sender. The row is written before
 * the provider call, so a crash can never leave an untracked SMS; the
 * audit update after the call is best-effort and never turns a successful
 * send into an error. The code, the message text, and credentials are
 * never written to the row or the log.
 */
final class RecordingSmsSender implements SmsSender
{
    public function __construct(private readonly SmsSender $sender) {}

    public function sendCode(string $phone, string $code): SmsReceipt
    {
        return $this->record(
            SmsMessage::KIND_CODE,
            $phone,
            fn (): SmsReceipt => $this->sender->sendCode($phone, $code),
        );
    }

    public function sendSubscriptionActivated(string $phone, string $planName): SmsReceipt
    {
        return $this->record(
            SmsMessage::KIND_SUBSCRIPTION_ACTIVATED,
            $phone,
            fn (): SmsReceipt => $this->sender->sendSubscriptionActivated($phone, $planName),
        );
    }

    public function deliveryStatus(string $recId): SmsDeliveryReport
    {
        return $this->sender->deliveryStatus($recId);
    }

    /** @param Closure(): SmsReceipt $send */
    private function record(string $kind, string $phone, Closure $send): SmsReceipt
    {
        $row = SmsMessage::create([
            'user_id' => User::query()->where('phone', $phone)->value('id'),
            'kind' => $kind,
            'phone' => $phone,
            'body_id' => $this->bodyId($kind),
            'status' => SmsMessage::STATUS_PENDING,
        ]);

        try {
            $receipt = $send();
        } catch (SmsSendFailed $e) {
            $this->recordFailure($row, $e);

            throw $e;
        } catch (Throwable $e) {
            $this->recordFailure($row, SmsSendFailed::unknown('unexpected'));

            throw $e;
        }

        try {
            $row->forceFill([
                'status' => SmsMessage::STATUS_ACCEPTED,
                'rec_id' => $receipt->recId,
            ])->save();
        } catch (Throwable $e) {
            report($e);
        }

        Log::info('SMS accepted', [
            'kind' => $kind,
            'phone' => PhoneNumber::mask($phone),
            'rec_id' => $receipt->recId,
        ]);

        return $receipt;
    }

    private function recordFailure(SmsMessage $row, SmsSendFailed $failure): void
    {
        try {
            $row->forceFill([
                'status' => $failure->isUnknown()
                    ? SmsMessage::STATUS_UNKNOWN
                    : SmsMessage::STATUS_REJECTED,
                'provider_code' => $failure->providerCode,
                'error_kind' => $failure->detail
                    ?? ($failure->kind === SmsSendFailed::KIND_UNAVAILABLE ? 'unavailable' : null),
            ])->save();

            Log::warning('SMS not accepted', [
                'kind' => $row->kind,
                'phone' => PhoneNumber::mask($row->phone),
                'status' => $row->status,
                'provider_code' => $failure->providerCode,
                'detail' => $failure->detail,
            ]);
        } catch (Throwable $e) {
            // The send failure is what the caller must see; an audit write
            // problem is secondary and must not replace it.
            report($e);
        }
    }

    private function bodyId(string $kind): ?int
    {
        $key = $kind === SmsMessage::KIND_CODE
            ? 'sms.melipayamak.otp_body_id'
            : 'sms.melipayamak.subscription_body_id';

        $value = config($key);

        return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
    }
}
