<?php

namespace App\Support\Sms;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * MelliPayamak panel REST client for the pattern service.
 *
 * Both messages go through `BaseServiceNumber`, which needs an approved
 * pattern (`bodyId`) and the ordered variable values joined by `;`. The
 * line is chosen by the pattern, so no sender line has to be configured
 * here. Only the panel web-service username/password travel with the form;
 * the base URL is fixed by configuration and redirects are refused.
 *
 * Acceptance is `RetStatus=1` plus a positive numeric receipt id. Known
 * refusal codes become `rejected` (safe to retry after fixing the cause);
 * timeouts, 5xx, redirects, HTML, and unreadable bodies become `unknown`
 * (must not be resent blindly). The raw provider body is never logged.
 */
final class MelliPayamakSender implements SmsSender
{
    /**
     * Documented refusal codes for the panel REST family: credentials/IP,
     * credit/limits, line/account state, recipient, filters, and the
     * pattern-specific negative codes.
     *
     * @var list<string>
     */
    private const REFUSAL_CODES = [
        '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-10',
        '-108', '-109', '-110', '-111',
        '0', '2', '3', '4', '5', '7', '9', '10', '11', '12',
        '14', '15', '16', '17', '18', '19', '35',
    ];

    /**
     * Delivery reports reuse small numbers for delivery states (`0`/`8`
     * in progress, `2`/`3` failed), so only the auth-shaped negatives are
     * refusals of the query itself.
     *
     * @var list<string>
     */
    private const DELIVERY_REFUSAL_CODES = ['-2', '-3', '-10', '-108', '-109', '-110', '-111'];

    /** HTTP statuses that explicitly reject the request (do not retry as-is). */
    private const REJECTED_HTTP = [400, 401, 403, 404, 405, 413, 415, 422];

    /** @param array{base_url?: string, username?: ?string, password?: ?string, otp_body_id?: int, subscription_body_id?: int, timeout?: int} $config */
    public function __construct(private array $config) {}

    public function sendCode(string $phone, string $code): SmsReceipt
    {
        if (preg_match('/^\d{6}$/', $code) !== 1) {
            throw SmsSendFailed::rejected('invalid_code');
        }

        return $this->sendPattern($this->bodyId('otp_body_id'), $phone, $code);
    }

    public function sendSubscriptionActivated(string $phone, string $planName): SmsReceipt
    {
        return $this->sendPattern(
            $this->bodyId('subscription_body_id'),
            $phone,
            self::patternArgument($planName),
        );
    }

    public function deliveryStatus(string $recId): SmsDeliveryReport
    {
        if (preg_match('/^\d+$/', $recId) !== 1) {
            throw SmsSendFailed::unknown('invalid_rec_id');
        }

        $payload = $this->post('GetDeliveries2', ['recId' => $recId]);
        $value = $this->value($payload);

        if ($value !== null && in_array($value, self::DELIVERY_REFUSAL_CODES, true)) {
            throw SmsSendFailed::rejected($value);
        }

        if (! $this->accepted($payload) || $value === null || preg_match('/^-?\d+$/', $value) !== 1) {
            throw SmsSendFailed::unknown('delivery_report');
        }

        $state = match ($value) {
            '1' => SmsDeliveryState::Delivered,
            '0', '8', '200', '400' => SmsDeliveryState::Pending,
            '2', '3', '16', '500' => SmsDeliveryState::Failed,
            '35' => SmsDeliveryState::Blocked,
            '300' => SmsDeliveryState::Filtered,
            default => SmsDeliveryState::Unknown,
        };

        return new SmsDeliveryReport($state, $value);
    }

    private function sendPattern(int $bodyId, string $phone, string $text): SmsReceipt
    {
        if ($bodyId < 1) {
            throw SmsSendFailed::unavailable();
        }

        $payload = $this->post('BaseServiceNumber', [
            'to' => $phone,
            'bodyId' => (string) $bodyId,
            'text' => $text,
        ]);

        $value = $this->value($payload);

        if ($value !== null && in_array($value, self::REFUSAL_CODES, true)) {
            throw SmsSendFailed::rejected($value);
        }

        if (! $this->accepted($payload) || $value === null) {
            throw SmsSendFailed::unknown('provider_status');
        }

        // The receipt id stays a string. A positive id of six or more
        // digits cannot collide with any documented refusal code.
        if (preg_match('/^[1-9]\d{5,}$/', $value) !== 1) {
            throw SmsSendFailed::unknown('receipt_id');
        }

        return new SmsReceipt($value);
    }

    private function bodyId(string $key): int
    {
        $value = $this->config[$key] ?? 0;

        return is_int($value) ? $value : (int) $value;
    }

    /**
     * The provider returns a JSON object with `Value`, `RetStatus`, and
     * `StrRetStatus`. Big integers are decoded as strings, and a body that
     * is not a JSON object (HTML 200, empty body, JSON array) is unknown.
     *
     * @param  array<string, string>  $fields
     * @return array<string, mixed>
     */
    private function post(string $operation, array $fields): array
    {
        $base = rtrim((string) ($this->config['base_url'] ?? ''), '/');
        $username = trim((string) ($this->config['username'] ?? ''));
        $password = (string) ($this->config['password'] ?? '');
        $timeout = (int) ($this->config['timeout'] ?? 8);

        if ($base === '' || $username === '' || $password === '') {
            throw SmsSendFailed::unavailable();
        }

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(max(1, $timeout))
                ->connectTimeout(max(1, min(5, $timeout)))
                ->withOptions(['allow_redirects' => false])
                ->post($base.'/'.$operation, [
                    'username' => $username,
                    'password' => $password,
                    ...$fields,
                ]);
        } catch (ConnectionException) {
            throw SmsSendFailed::unknown('network');
        } catch (Throwable) {
            throw SmsSendFailed::unknown('transport');
        }

        $status = $response->status();

        if ($status >= 500 || $status === 408 || $status === 429) {
            throw SmsSendFailed::unknown('http_'.$status);
        }

        if (! $response->successful()) {
            if (in_array($status, self::REJECTED_HTTP, true)) {
                throw SmsSendFailed::rejected('http_'.$status);
            }

            throw SmsSendFailed::unknown('http_'.$status);
        }

        $body = trim($response->body());

        if ($body === '' || str_starts_with($body, '<')) {
            throw SmsSendFailed::unknown('invalid_response');
        }

        $payload = json_decode($body, true, 512, JSON_BIGINT_AS_STRING);

        if (! is_array($payload) || array_is_list($payload)) {
            throw SmsSendFailed::unknown('invalid_response');
        }

        return $payload;
    }

    /** @param array<string, mixed> $payload */
    private function accepted(array $payload): bool
    {
        $status = $payload['RetStatus'] ?? null;

        return $status === 1 || $status === '1';
    }

    /**
     * `Value` is a receipt id on acceptance, a code on refusal, and a
     * delivery code on `GetDeliveries2`. Floats are ignored so a lost
     * precision digit can never masquerade as an acceptance id.
     *
     * @param  array<string, mixed>  $payload
     */
    private function value(array $payload): ?string
    {
        $value = $payload['Value'] ?? null;

        if (is_int($value)) {
            return (string) $value;
        }

        if (is_string($value) && $value !== '') {
            return $value;
        }

        return null;
    }

    /**
     * A pattern variable cannot contain `;` (it separates the ordered
     * values) or control characters, and must stay short enough for the
     * approved template. The plan snapshot is server-written, but this
     * boundary still sanitizes it.
     */
    private static function patternArgument(string $value): string
    {
        $clean = preg_replace('/[;\x00-\x1F\x7F]+/u', ' ', $value) ?? '';
        $clean = trim(preg_replace('/\s+/u', ' ', $clean) ?? '');
        $clean = mb_substr($clean, 0, 40);

        return $clean === '' ? 'انتخابی' : $clean;
    }
}
