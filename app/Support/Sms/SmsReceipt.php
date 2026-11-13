<?php

namespace App\Support\Sms;

/**
 * The provider's acceptance id for one message. It is kept as a string
 * from the first read to the database: MelliPayamak receipt ids are long
 * numbers and casting one through a float (JavaScript, some JSON paths)
 * changes its digits.
 */
final class SmsReceipt
{
    public function __construct(public readonly ?string $recId) {}
}
