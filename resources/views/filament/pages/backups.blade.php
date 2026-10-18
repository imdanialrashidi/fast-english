<x-filament-panels::page>
    @if (session('status'))
        <p>{{ session('status') }}</p>
    @endif

    @if ($errors->any())
        <div role="alert">
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <x-filament::section heading="One-click backup">
        <p>Creates a complete archive: database records + relationships, lesson audio, receipts, covers, and a manifest with checksums. Backups stay on the private disk and are staff-only.</p>
        <p><strong>Same-server copies do not protect against losing the server.</strong> Keep at least one encrypted copy off the VPS with a 30-day rotation (see ENV_RECOVERY.md inside each archive).</p>
        @if ($lastCompleted)
            <p>Last successful backup: #{{ $lastCompleted['id'] }} at {{ $lastCompleted['completed_at'] }} ({{ $lastCompleted['size_human'] }}).</p>
        @else
            <p>No successful backup yet.</p>
        @endif
        <form method="POST" action="{{ route('staff.backups.store') }}">
            @csrf
            <x-filament::button type="submit">Create backup now</x-filament::button>
        </form>
    </x-filament::section>

    <x-filament::section heading="Upload a backup archive">
        <p>Upload a ZIP created by this panel to register it for restore. Archives are validated (format, checksums, no path traversal) before they are kept.</p>
        <form method="POST" action="{{ route('staff.backups.upload') }}" enctype="multipart/form-data">
            @csrf
            <input type="file" name="backup" accept=".zip,application/zip" required aria-label="Backup archive" />
            <x-filament::button type="submit">Upload and verify</x-filament::button>
        </form>
    </x-filament::section>

    <x-filament::section heading="Previous backups">
        @forelse ($items as $item)
            <article style="margin-bottom: 1rem;">
                <p>
                    <strong>#{{ $item['id'] }}</strong>
                    — {{ $item['status'] }} ({{ $item['type'] }})
                    — {{ $item['created_at'] ?? '—' }}
                    — {{ $item['size_human'] }}
                    — sha {{ $item['checksum_short'] }}
                </p>
                @if ($item['error_message'])
                    <p role="alert">{{ $item['error_message'] }}</p>
                @endif
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <a href="{{ route('staff.backups.status', $item['id']) }}">Status (JSON)</a>
                    @if (in_array($item['status'], ['completed', 'restored'], true))
                        <a href="{{ route('staff.backups.download', $item['id']) }}">Download</a>
                    @endif
                    <form method="POST" action="{{ route('staff.backups.destroy', $item['id']) }}" onsubmit="return confirm('Delete backup #{{ $item['id'] }}?');">
                        @csrf
                        @method('DELETE')
                        <x-filament::button type="submit" color="danger">Delete</x-filament::button>
                    </form>
                    @if (in_array($item['status'], ['completed', 'restored'], true))
                        <form method="POST" action="{{ route('staff.backups.restore', $item['id']) }}" onsubmit="return confirm('RESTORE backup #{{ $item['id'] }}? This REPLACES all current data. A verified pre-restore recovery point is created first, but confirm you understand the data will be replaced.');">
                            @csrf
                            <input type="hidden" name="backup_id" value="{{ $item['id'] }}" />
                            <label>
                                <input type="checkbox" name="acknowledge" value="1" required />
                                I understand this replaces all current data
                            </label>
                            <input type="hidden" name="confirm" value="1" />
                            <x-filament::button type="submit" color="danger">Restore this backup</x-filament::button>
                        </form>
                    @endif
                </div>
            </article>
        @empty
            <p>No backups yet. Create the first one above.</p>
        @endforelse
    </x-filament::section>
</x-filament-panels::page>
