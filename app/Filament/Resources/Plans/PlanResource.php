<?php

namespace App\Filament\Resources\Plans;

use App\Filament\Resources\Plans\Pages\CreatePlan;
use App\Filament\Resources\Plans\Pages\EditPlan;
use App\Filament\Resources\Plans\Pages\ListPlans;
use App\Filament\Resources\Plans\Schemas\PlanForm;
use App\Filament\Resources\Plans\Tables\PlansTable;
use App\Models\Plan;
use App\Support\Entitlement;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use UnitEnum;

/**
 * Staff plan catalog. Prices are integer toman; the owner can change the
 * catalog without a deploy. Deleting is intentionally unavailable because
 * payment requests keep a plan snapshot and history.
 */
class PlanResource extends Resource
{
    protected static ?string $model = Plan::class;

    protected static ?string $navigationLabel = 'Plans';

    protected static string|UnitEnum|null $navigationGroup = 'Business';

    protected static ?int $navigationSort = 2;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCreditCard;

    public static function form(Schema $schema): Schema
    {
        return PlanForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PlansTable::configure($table);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPlans::route('/'),
            'create' => CreatePlan::route('/create'),
            'edit' => EditPlan::route('/{record}/edit'),
        ];
    }

    public static function canViewAny(): bool
    {
        return Entitlement::staff(auth()->user());
    }
}
