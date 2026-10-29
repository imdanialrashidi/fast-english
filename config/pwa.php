<?php

// S2 PWA/TWA settings. Secrets and host-specific values live in the
// untracked environment file, never here.

return [

    /*
    |--------------------------------------------------------------------------
    | Service worker version
    |--------------------------------------------------------------------------
    |
    | Baked into the versioned cache names (fe-public-<version>). Bump to
    | roll caches. The /sw.js route prefers storage/app/sw-version when
    | present so browser tests can trigger a real update without a restart.
    |
    */

    'sw_version' => env('SW_VERSION') ?: '2026-10-28-2',

    /*
    |--------------------------------------------------------------------------
    | TWA / Digital Asset Links
    |--------------------------------------------------------------------------
    |
    | Package com.fastenglishpodcast.app and the SHA-256 fingerprint of the
    | 1.0.0 release certificate. These are public values (Android reads them
    | from /.well-known/assetlinks.json). The fingerprint default applies in
    | production only, so tests keep their empty-statement assertions; a
    | real TWA_SHA256_FINGERPRINT env value always wins.
    |
    */

    'twa_package' => env('TWA_PACKAGE_NAME') ?: 'com.fastenglishpodcast.app',

    'twa_fingerprint' => env('TWA_SHA256_FINGERPRINT') ?: (env('APP_ENV') === 'production'
        ? '9F:C0:C8:96:15:DC:7A:AA:3C:F8:4A:1F:1F:9D:80:92:E0:CB:B0:57:7D:8C:74:C8:98:4E:31:3E:E7:BB:B5:AF'
        : null),
];
