<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');

// Per-test isolation (storage fakes + the browser-database guard) lives in
// Tests\TestCase::setUp(). Pest hooks declared here were not executing on
// this Pest version, so keeping them would be a silent no-op.
