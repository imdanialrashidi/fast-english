@php($lesson = $getRecord())

@if ($lesson !== null && filled($lesson->audio_path))
    <div class="rounded-lg border border-gray-200 p-3">
        <p class="mb-2 text-sm font-medium text-gray-950">Audio preview (private, staff-only)</p>
        <audio controls preload="metadata" class="w-full" src="{{ route('staff.lesson.audio', $lesson) }}"></audio>
    </div>
@endif
