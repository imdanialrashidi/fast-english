<x-filament-panels::page>
    <form wire:submit="save" class="grid gap-6">
        <x-filament::section
            heading="Contact channels"
            description="Shown on the public support and cooperation pages. Use @handle, an email address, or an https URL."
        >
            <div class="grid gap-5 md:grid-cols-2">
                <div class="grid gap-2">
                    <label for="supportChannel" class="text-sm font-medium">Support channel</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="supportChannel" type="text" dir="ltr" wire:model="supportChannel" />
                    </x-filament::input.wrapper>
                    @error('supportChannel')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="supportHours" class="text-sm font-medium">Support hours (optional)</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="supportHours" type="text" wire:model="supportHours" placeholder="مثلاً شنبه تا پنجشنبه، ۹ تا ۱۸" />
                    </x-filament::input.wrapper>
                    @error('supportHours')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="cooperationChannel" class="text-sm font-medium">Cooperation channel</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="cooperationChannel" type="text" dir="ltr" wire:model="cooperationChannel" />
                    </x-filament::input.wrapper>
                    @error('cooperationChannel')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>
            </div>
        </x-filament::section>

        <x-filament::section
            heading="Card destination"
            description="Used for card-to-card checkout. The obvious placeholder keeps checkout disabled until a real 16-digit card and holder/bank are saved."
        >
            <div class="grid gap-5 md:grid-cols-2">
                <div class="grid gap-2">
                    <label for="cardNumber" class="text-sm font-medium">Card number (16 digits)</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="cardNumber" type="text" dir="ltr" inputmode="numeric" maxlength="19" wire:model="cardNumber" />
                    </x-filament::input.wrapper>
                    @error('cardNumber')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                    <p class="text-xs text-gray-500">Current value: {{ $cardNumber === '' ? 'empty' : $cardNumber }}. Placeholder: {{ \App\Models\PaymentDestination::PLACEHOLDER_CARD }}.</p>
                </div>

                <div class="grid gap-2">
                    <label for="cardHolder" class="text-sm font-medium">Card holder</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="cardHolder" type="text" wire:model="cardHolder" />
                    </x-filament::input.wrapper>
                    @error('cardHolder')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="cardBank" class="text-sm font-medium">Bank</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="cardBank" type="text" wire:model="cardBank" />
                    </x-filament::input.wrapper>
                    @error('cardBank')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2 md:col-span-2">
                    <label for="cardInstructions" class="text-sm font-medium">Transfer instructions (optional)</label>
                    <textarea id="cardInstructions" rows="3" class="fi-input block w-full" wire:model="cardInstructions"></textarea>
                    @error('cardInstructions')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <label class="flex items-center gap-2 md:col-span-2">
                    <x-filament::input.checkbox wire:model="cardFallback" />
                    <span class="text-sm">Allow card-to-card fallback when a gateway is not active</span>
                </label>
            </div>
        </x-filament::section>

        <x-filament::section
            heading="Online gateway (prepared, not live)"
            description="The provider contract is not implemented yet. These values are stored so the switch can be completed without a schema change; card fallback remains the only live checkout."
        >
            @if (! $gatewayDriverReady)
                <p class="mb-4 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-800">
                    No gateway driver is registered. Enabling the switch does not process online payments until the provider driver and callback are implemented.
                </p>
            @endif

            <div class="grid gap-5 md:grid-cols-2">
                <label class="flex items-center gap-2 md:col-span-2">
                    <x-filament::input.checkbox wire:model="gatewayEnabled" />
                    <span class="text-sm">Enable online gateway (requires a registered driver)</span>
                </label>

                <div class="grid gap-2">
                    <label for="gatewayProvider" class="text-sm font-medium">Provider key</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="gatewayProvider" type="text" dir="ltr" wire:model="gatewayProvider" placeholder="e.g. zarinpal" />
                    </x-filament::input.wrapper>
                    @error('gatewayProvider')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="gatewayMerchantId" class="text-sm font-medium">Merchant ID</label>
                    <x-filament::input.wrapper>
                        <x-filament::input id="gatewayMerchantId" type="text" dir="ltr" wire:model="gatewayMerchantId" />
                    </x-filament::input.wrapper>
                    @error('gatewayMerchantId')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                    <p class="text-xs text-gray-500">Do not paste API secrets or private keys here; they belong in the server secret store.</p>
                </div>

                <label class="flex items-center gap-2">
                    <x-filament::input.checkbox wire:model="gatewaySandbox" />
                    <span class="text-sm">Use provider sandbox/test mode</span>
                </label>
            </div>
        </x-filament::section>

        <x-filament::section
            heading="Public legal copy"
            description="Rendered as paragraphs on /terms, /privacy, and /refund. Blank lines separate paragraphs. Review with a qualified adviser before launch."
        >
            <div class="grid gap-5">
                <div class="grid gap-2">
                    <label for="terms" class="text-sm font-medium">Terms of use</label>
                    <textarea id="terms" rows="12" class="fi-input block w-full" dir="rtl" wire:model="terms"></textarea>
                    @error('terms')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="privacy" class="text-sm font-medium">Privacy policy</label>
                    <textarea id="privacy" rows="12" class="fi-input block w-full" dir="rtl" wire:model="privacy"></textarea>
                    @error('privacy')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="grid gap-2">
                    <label for="refund" class="text-sm font-medium">Refund policy</label>
                    <textarea id="refund" rows="12" class="fi-input block w-full" dir="rtl" wire:model="refund"></textarea>
                    @error('refund')
                        <p class="text-sm text-danger-600">{{ $message }}</p>
                    @enderror
                </div>
            </div>
        </x-filament::section>

        <div>
            <x-filament::button type="submit" wire:loading.attr="disabled">
                Save settings
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>
