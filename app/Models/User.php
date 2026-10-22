<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\Entitlement;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_staff' => 'boolean',
            'disabled_at' => 'datetime',
            // S8 staff TOTP (scope §5): the secret is stored encrypted;
            // recovery codes persist as SHA-256 hashes only (never plain).
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            // S4: explicit preferred level only (LEVEL-01). Null means no
            // preference yet; browsing a ?level= URL never writes here.
            'preferred_level' => 'string',
            // R5: explicit daily goal only (PLAN-01). Changing it never
            // writes preferred_level.
            'daily_goal_minutes' => 'integer',
        ];
    }

    public function lessonProgress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function paymentRequests(): HasMany
    {
        return $this->hasMany(PaymentRequest::class);
    }

    /**
     * S6 current subscription window, if any (scope §11.1). Access is
     * computed from this row per request — see Entitlement.
     */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function subscriptionEvents(): HasMany
    {
        return $this->hasMany(SubscriptionEvent::class);
    }

    /**
     * R4 personal vocabulary notebook (VOCAB-01). Owner-only access is
     * enforced in VocabularyWordPolicy, never in the client.
     */
    public function vocabularyWords(): HasMany
    {
        return $this->hasMany(VocabularyWord::class);
    }

    /**
     * S0: only staff may reach the /admin panel. Suspended accounts
     * (disabled_at set) are refused even when the staff flag is present.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return Entitlement::staff($this);
    }
}
