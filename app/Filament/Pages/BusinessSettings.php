<?php

namespace App\Filament\Pages;

use App\Models\PaymentDestination;
use App\Models\Setting;
use App\Support\Entitlement;
use App\Support\SiteSettings;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use UnitEnum;

/**
 * Owner-editable business settings (2026-10-25): support/cooperation
 * channels, the card-to-card destination, and public legal copy.
 *
 * There is no online gateway (owner decision 2026-10-30). The only payment
 * method is a transfer to the active card destination plus a private
 * receipt reviewed by staff. Checkout stays closed while the destination
 * is the placeholder.
 */
class BusinessSettings extends Page
{
    protected string $view = 'filament.pages.business-settings';

    protected static ?string $navigationLabel = 'Business settings';

    protected static ?string $title = 'Business settings';

    protected static string|UnitEnum|null $navigationGroup = 'Business';

    protected static ?int $navigationSort = 1;

    public string $supportChannel = '';

    public string $supportHours = '';

    public string $cooperationChannel = '';

    public string $cardNumber = '';

    public string $cardHolder = '';

    public string $cardBank = '';

    public string $cardInstructions = '';

    public string $terms = '';

    public string $privacy = '';

    public string $refund = '';

    public function mount(): void
    {
        $destination = PaymentDestination::query()->where('is_active', true)->first();

        $this->supportChannel = SiteSettings::supportChannel();
        $this->supportHours = SiteSettings::supportHours() ?? '';
        $this->cooperationChannel = SiteSettings::cooperationChannel();
        $this->cardNumber = $destination?->card_number ?? PaymentDestination::PLACEHOLDER_CARD;
        $this->cardHolder = $destination?->holder_name ?? PaymentDestination::PLACEHOLDER_HOLDER;
        $this->cardBank = $destination?->bank_name ?? PaymentDestination::PLACEHOLDER_BANK;
        $this->cardInstructions = $destination?->instructions ?? '';
        $this->terms = SiteSettings::legal('terms') ?? '';
        $this->privacy = SiteSettings::legal('privacy') ?? '';
        $this->refund = SiteSettings::legal('refund') ?? '';
    }

    public function save(): void
    {
        // Owners often paste a card number from a Persian banking app.
        // Normalize Persian/Arabic-Indic digits before stripping separators;
        // otherwise "۶۰۳۷…" becomes an empty string and checkout silently
        // closes after a "successful" save.
        $this->cardNumber = $this->normalizeCardNumber($this->cardNumber);

        $this->validate([
            'supportChannel' => ['required', 'string', 'max:120'],
            'supportHours' => ['nullable', 'string', 'max:120'],
            'cooperationChannel' => ['required', 'string', 'max:120'],
            'cardNumber' => ['nullable', 'regex:/^\d{16}$/'],
            'cardHolder' => ['nullable', 'string', 'max:120'],
            'cardBank' => ['nullable', 'string', 'max:120'],
            'cardInstructions' => ['nullable', 'string', 'max:2000'],
            'terms' => ['required', 'string', 'max:20000'],
            'privacy' => ['required', 'string', 'max:20000'],
            'refund' => ['required', 'string', 'max:20000'],
        ], [
            'cardNumber.regex' => 'شمارهٔ کارت باید دقیقاً ۱۶ رقم باشد.',
            'supportChannel.required' => 'کانال پشتیبانی الزامی است.',
            'cooperationChannel.required' => 'کانال همکاری الزامی است.',
            'terms.required' => 'متن قوانین الزامی است.',
            'privacy.required' => 'متن حریم خصوصی الزامی است.',
            'refund.required' => 'متن بازگشت وجه الزامی است.',
        ]);

        // A card number without a holder/bank can never pass
        // PaymentDestination::isConfigured(); reject it at the boundary
        // instead of accepting a silently closed checkout.
        if ($this->cardNumber !== '') {
            $errors = [];
            if (trim($this->cardHolder) === '') {
                $errors['cardHolder'] = 'When a card number is set, the card holder is required.';
            }
            if (trim($this->cardBank) === '') {
                $errors['cardBank'] = 'When a card number is set, the bank is required.';
            }
            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }
        }

        DB::transaction(function (): void {
            Setting::put(SiteSettings::SUPPORT_CHANNEL, $this->supportChannel);
            Setting::put(SiteSettings::SUPPORT_HOURS, $this->supportHours);
            Setting::put(SiteSettings::COOPERATION_CHANNEL, $this->cooperationChannel);
            Setting::put('legal.terms', $this->terms);
            Setting::put('legal.privacy', $this->privacy);
            Setting::put('legal.refund', $this->refund);

            $destination = PaymentDestination::query()->where('is_active', true)->first()
                ?? new PaymentDestination;
            $destination->forceFill([
                'card_number' => $this->cardNumber,
                'holder_name' => $this->cardHolder,
                'bank_name' => $this->cardBank,
                'instructions' => $this->cardInstructions,
                'is_active' => true,
            ])->save();
        });

        Notification::make()
            ->title('تنظیمات ذخیره شد')
            ->success()
            ->send();
    }

    private function normalizeCardNumber(string $value): string
    {
        $value = strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);

        return preg_replace('/\D+/', '', $value) ?? '';
    }

    public static function canAccess(): bool
    {
        return Entitlement::staff(auth()->user());
    }
}
