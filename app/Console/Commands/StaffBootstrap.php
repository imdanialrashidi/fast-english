<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * S6 staff bootstrap (scope §5): staff accounts come from this controlled
 * CLI — never from public registration. The creator (--by, required) is
 * logged with every creation/upgrade so each staff account has a named
 * responsible party. Works in every environment, including production.
 */
class StaffBootstrap extends Command
{
    protected $signature = 'staff:bootstrap
        {email : Email of the staff account}
        {--name= : Display name (defaults to the email local part)}
        {--by= : Who creates this staff account (required, logged)}
        {--password= : Password for a new account (required when creating)}';

    protected $description = 'Create or upgrade a staff account, logging who created it.';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $by = trim((string) $this->option('by'));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('A valid email is required.');

            return 1;
        }

        if ($by === '') {
            $this->error('The --by option is required: name who creates this staff account.');

            return 1;
        }

        $existing = User::where('email', $email)->first();

        if ($existing === null) {
            $password = trim((string) $this->option('password'));
            if ($password === '') {
                $this->error('A password is required for a new staff account: pass --password. Nothing was created.');

                return 1;
            }

            $user = new User;
            $user->forceFill([
                'name' => (string) ($this->option('name') ?: explode('@', $email)[0]),
                'email' => $email,
                'password' => Hash::make($password),
                'is_staff' => true,
                'email_verified_at' => now(),
            ]);
            $user->save();

            Log::info('staff.bootstrap', ['email' => $email, 'by' => $by, 'upgraded' => false]);
            $this->info("Staff account [{$email}] created by [{$by}].");

            return 0;
        }

        $wasStaff = (bool) $existing->is_staff;
        $existing->forceFill(['is_staff' => true]);
        $existing->save();

        Log::info('staff.bootstrap', ['email' => $email, 'by' => $by, 'upgraded' => ! $wasStaff]);
        $this->info($wasStaff
            ? "Staff account [{$email}] already staff; creator [{$by}] logged."
            : "Account [{$email}] upgraded to staff by [{$by}].");

        return 0;
    }
}
