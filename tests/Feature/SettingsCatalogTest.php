<?php

use App\Filament\Pages\BusinessSettings;
use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Models\Setting;
use App\Support\SiteSettings;
use Database\Seeders\PlanCatalogSeeder;
use Livewire\Livewire;
use Tests\Support\ContentFixtures;

// Owner pricing/settings slice (2026-10-25): the production catalog is
// explicit, a fresh destination is a safe placeholder, and staff can
// replace the destination and public copy without a deploy.

test('the owner catalog seeder installs exact prices and a safe placeholder', function () {
    $this->seed(PlanCatalogSeeder::class);

    expect(Plan::where('slug', 'monthly')->firstOrFail()->price_toman)->toBe(399000)
        ->and(Plan::where('slug', 'quarterly')->firstOrFail()->price_toman)->toBe(957600)
        ->and(Plan::where('slug', 'annual')->firstOrFail()->price_toman)->toBe(3351600)
        ->and(Plan::where('slug', 'quarterly')->firstOrFail()->duration_days)->toBe(90)
        ->and(Plan::where('slug', 'annual')->firstOrFail()->duration_days)->toBe(365);

    $destination = PaymentDestination::where('is_active', true)->firstOrFail();

    expect($destination->card_number)->toBe(PaymentDestination::PLACEHOLDER_CARD)
        ->and($destination->isConfigured())->toBeFalse();
});

test('staff can save contact channels and a real card destination', function () {
    $staff = ContentFixtures::staff();

    $this->actingAs($staff);

    Livewire::test(BusinessSettings::class)
        ->set('supportChannel', '@owner_support')
        ->set('cooperationChannel', '@owner_coop')
        ->set('cardNumber', '6037 9911 1234 5678')
        ->set('cardHolder', 'مالک کارت')
        ->set('cardBank', 'بانک نمونه')
        ->set('terms', 'متن قوانین آزمایشی برای این تست.')
        ->set('privacy', 'متن حریم خصوصی آزمایشی برای این تست.')
        ->set('refund', 'متن بازگشت وجه آزمایشی برای این تست.')
        ->call('save')
        ->assertHasNoErrors();

    expect(Setting::read(SiteSettings::SUPPORT_CHANNEL))->toBe('@owner_support')
        ->and(Setting::read(SiteSettings::COOPERATION_CHANNEL))->toBe('@owner_coop');

    $destination = PaymentDestination::where('is_active', true)->firstOrFail();

    expect($destination->card_number)->toBe('6037991112345678')
        ->and($destination->isConfigured())->toBeTrue();
});

test('business settings expose card-to-card only, with no gateway controls', function () {
    $this->actingAs(ContentFixtures::staff());

    Livewire::test(BusinessSettings::class)
        ->assertOk()
        ->assertSee('Card destination (the only payment method)')
        ->assertDontSee('Online gateway')
        ->assertDontSee('Merchant ID')
        ->assertDontSee('gateway');
});

test('a placeholder destination refuses payment creation with nothing stored', function () {
    $plan = Plan::factory()->create(['is_active' => true]);
    PaymentDestination::factory()->create([
        'card_number' => PaymentDestination::PLACEHOLDER_CARD,
        'holder_name' => PaymentDestination::PLACEHOLDER_HOLDER,
        'bank_name' => PaymentDestination::PLACEHOLDER_BANK,
        'is_active' => true,
    ]);
    $student = ContentFixtures::student();

    $this->actingAs($student)
        ->postJson(route('payments.store'), ['plan_id' => $plan->id])
        ->assertStatus(422)
        ->assertJsonPath('message', 'روش پرداخت هنوز پیکربندی نشده است. لطفاً بعداً تلاش کنید.');

    expect(PaymentRequest::count())->toBe(0);
});
