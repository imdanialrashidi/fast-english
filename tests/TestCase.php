<?php

namespace Tests;

use App\Support\BrowserDatabaseGuard;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Pest hooks declared in tests/Pest.php do not run on this Pest
        // version, so the storage fake lives here where it is guaranteed
        // to execute. Without it, seeders copy real MP3 fixtures into the
        // developer's real storage tree (16k files / 2.6 GB had piled up)
        // and every panel export archive carried them.
        Storage::fake('local');
        Storage::fake('public');

        // S2: the suite must never point at the browser-lane database.
        BrowserDatabaseGuard::ensureNotBrowserDatabase(
            (string) config('database.connections.'.config('database.default').'.database')
        );
    }
}
