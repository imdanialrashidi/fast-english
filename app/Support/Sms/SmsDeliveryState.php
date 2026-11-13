<?php

namespace App\Support\Sms;

/**
 * Provider delivery report, reduced to the states the application acts on.
 * `Pending` means the operator is still processing the message, not that
 * it failed; the delivery command keeps polling those.
 */
enum SmsDeliveryState: string
{
    case Delivered = 'delivered';
    case Pending = 'pending';
    case Failed = 'failed';
    case Blocked = 'blocked';
    case Filtered = 'filtered';
    case Unknown = 'unknown';
}
