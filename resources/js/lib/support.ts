import type { SupportContact } from '@/types';

/**
 * One client-side shape for the owner-confirmed support channels.
 *
 * The server sends the real values through the shared `support` prop.
 * The literals here are only a last-resort fallback so a page rendered
 * without that prop still shows the owner's number instead of a dead
 * support block. Change the source in `config/site.php`, not here.
 */
export interface SupportChannels {
    phone: string;
    phoneHref: string;
    bale: string;
    telegram: string;
    messenger: string;
}

export function supportChannels(support: SupportContact | null): SupportChannels {
    return {
        phone: support?.phone ?? '09924930667',
        phoneHref: support?.phone_href ?? 'tel:+989924930667',
        bale: support?.bale_url ?? 'https://ble.ir/+989924930667',
        telegram: support?.telegram_url ?? 'https://t.me/+989924930667',
        messenger: support?.messenger ?? 'بله یا تلگرام',
    };
}
