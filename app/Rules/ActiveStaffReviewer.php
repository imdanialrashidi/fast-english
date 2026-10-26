<?php

namespace App\Rules;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Content review is a staff responsibility (scope ADM-01): the reviewer
 * picker must not accept a learner or a suspended account even if a
 * crafted Livewire request posts another user id.
 */
class ActiveStaffReviewer implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $isActiveStaff = User::query()
            ->whereKey($value)
            ->where('is_staff', true)
            ->whereNull('disabled_at')
            ->exists();

        if (! $isActiveStaff) {
            $fail('The reviewer must be an active staff account.');
        }
    }
}
