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

    @forelse ($versions as $version)
        <x-filament::section :heading="'Version '.$version['version']">
            <p>Status: {{ $version['status'] }}{{ $version['is_current'] ? ' (current)' : '' }} — {{ $version['question_count'] }} / 20 questions.</p>

            @if ($version['status'] !== 'published')
                <form method="POST" action="{{ route('staff.placement.publish', $version['id']) }}"
                      onsubmit="return confirm('Publish this version and make it current? The previous current version is retired.');">
                    @csrf
                    <x-filament::button type="submit">Publish this version</x-filament::button>
                </form>
            @endif

            <ol>
                @foreach ($version['questions'] as $question)
                    <li>
                        <span lang="en" dir="ltr">{{ $question['position'] }}. {{ $question['prompt'] }}</span>
                        <ul>
                            @foreach (($question['options'] ?? []) as $index => $option)
                                <li lang="en" dir="ltr">{{ $index }}. {{ $option }}{{ (int) $question['correct_option'] === (int) $index ? ' (correct)' : '' }}</li>
                            @endforeach
                        </ul>
                    </li>
                @endforeach
            </ol>
        </x-filament::section>
    @empty
        <p>No placement versions yet.</p>
    @endforelse
</x-filament-panels::page>
