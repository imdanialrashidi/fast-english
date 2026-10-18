<?php

namespace Database\Factories;

use App\Models\PlacementTest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlacementTest>
 *
 * Draft versions only; publishing goes through PublishPlacementTest so
 * the 20-question rule and the single-current invariant stay in one
 * place. scoring_rules carries the FIXTURE map (server-only, hidden).
 */
class PlacementTestFactory extends Factory
{
    protected $model = PlacementTest::class;

    public function definition(): array
    {
        return [
            'version' => 's7-test-'.$this->faker->unique()->lexify('??????').' (TEST)',
            'status' => PlacementTest::STATUS_DRAFT,
            'is_current' => false,
            'scoring_rules' => ['note' => 'FIXTURE — not a validated CEFR scale', 'map' => \App\Support\PlacementLevel::fixtureMap()],
        ];
    }
}
