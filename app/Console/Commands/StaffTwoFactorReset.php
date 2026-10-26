<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Operational recovery for a staff member who lost both their TOTP device
 * and recovery codes. The owner runs this from the server shell; the
 * requester and reason are logged. It clears the second factor only, never
 * the password. The next panel visit starts a fresh enrolment.
 */
class StaffTwoFactorReset extends Command
{
    protected $signature = 'staff:2fa-reset
        {email : Staff account email}
        {--by= : Who authorized this recovery (required, logged)}
        {--reason= : Why this reset was needed (required, logged)}';

    protected $description = 'Clear a staff account TOTP secret/recovery codes so it can re-enrol.';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $by = trim((string) $this->option('by'));
        $reason = trim((string) $this->option('reason'));

        if ($by === '') {
            $this->error('The --by option is required: name who authorized this reset.');

            return self::FAILURE;
        }

        if ($reason === '') {
            $this->error('The --reason option is required.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if ($user === null) {
            $this->error("User [{$email}] was not found.");

            return self::FAILURE;
        }

        if (! $user->is_staff) {
            $this->error("User [{$email}] is not a staff account.");

            return self::FAILURE;
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        Log::info('staff.2fa.reset', [
            'user_id' => $user->id,
            'email' => $user->email,
            'by' => $by,
            'reason' => $reason,
        ]);

        $this->info("Staff 2FA cleared for [{$email}]. The account re-enrols on its next panel visit.");

        return self::SUCCESS;
    }
}
