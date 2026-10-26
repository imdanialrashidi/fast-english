<x-filament-panels::page>
    @if (session('status'))
        <p role="status" class="rounded-lg bg-success-50 p-3 text-sm text-success-800">{{ session('status') }}</p>
    @endif

    @if ($errors->any())
        <div role="alert" class="rounded-lg bg-danger-50 p-3 text-sm text-danger-800">
            <ul class="list-inside list-disc space-y-1">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <x-filament::section heading="Export">
        <div class="space-y-3 text-sm leading-6 text-gray-700">
        <p>
            Downloads one ZIP with every table (content, plans, settings, users, subscriptions and
            payment records) plus the files those rows reference — lesson audio, receipts and covers.
            Orphan files on the disk are not included, so the archive stays small.
        </p>
        <p>
            The archive contains personal data (accounts and receipts). Treat it like the database:
            keep it private and never upload it to a public host.
        </p>
        <p>
            <a class="fi-btn" href="{{ route('staff.transfer.export') }}">Download export (.zip)</a>
        </p>
        </div>
    </x-filament::section>

    <x-filament::section heading="Import">
        <div class="space-y-3 text-sm leading-6 text-gray-700">
        <p>
            Importing <strong>replaces all current data</strong> — rows and the managed files
            (lessons, receipts, covers). A safety copy of the current state is written first and kept
            as the undo point.
        </p>
        <p>
            The archive is validated before anything changes: format, Laravel version, migration set,
            paths and every checksum.
        </p>
        <p>
            Accounts are part of the archive, so you may be signed out right after the import —
            sign back in with an account that exists inside it.
        </p>
        <form method="POST" action="{{ route('staff.transfer.import') }}" enctype="multipart/form-data">
            @csrf
            <p>
                <label for="archive">Export archive (.zip)</label><br />
                <input id="archive" type="file" name="archive" accept=".zip,application/zip" required />
            </p>
            <p>
                <label>
                    <input type="checkbox" name="confirm" value="1" required />
                    I understand this replaces all current data.
                </label>
            </p>
            <x-filament::button type="submit" color="danger">Import and replace</x-filament::button>
        </form>
        </div>
    </x-filament::section>

    <x-filament::section heading="Safety copy">
        <div class="space-y-3 text-sm leading-6 text-gray-700">
        @if ($safetyName)
            <p>
                Latest pre-import copy: <code>{{ $safetyName }}</code> ({{ $safetySize }}).
                Only the newest one is kept.
            </p>
            <p>
                <a class="fi-btn" href="{{ route('staff.transfer.safety') }}">Download safety copy</a>
            </p>
            <p>To undo, import that file the same way.</p>
        @else
            <p>No safety copy yet. One is created automatically before each import.</p>
        @endif
        </div>
    </x-filament::section>
</x-filament-panels::page>
