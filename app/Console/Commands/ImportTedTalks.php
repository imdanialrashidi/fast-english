<?php

namespace App\Console\Commands;

use App\Models\TedTalk;
use App\Models\Topic;
use App\Models\User;
use App\Support\CoverImage;
use App\Support\TedContent;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Import the reviewed TED pack into one environment.
 *
 * The pack is a manifest plus one `final.json` per talk (sentence cues and
 * ten words). Files are content-addressed, so replacing audio bumps the
 * revision automatically. Import is draft-only unless `--publish` is given
 * with a real staff reviewer; republishing a changed talk requires a new
 * explicit review, exactly like lessons.
 */
class ImportTedTalks extends Command
{
    protected $signature = 'ted:import
        {path : directory containing manifest.json}
        {--publish : publish the imported talks}
        {--reviewer= : staff email recorded as the reviewer}
        {--dry-run : validate and report without writing}';

    protected $description = 'Import the TED Talk content pack (idempotent, draft by default)';

    public function handle(): int
    {
        $root = realpath($this->argument('path'));
        if ($root === false || ! is_file($root.'/manifest.json')) {
            $this->error('manifest.json not found under the given path.');

            return self::FAILURE;
        }

        $manifest = json_decode((string) file_get_contents($root.'/manifest.json'), true);
        if (! is_array($manifest['talks'] ?? null)) {
            $this->error('manifest.json has no talks array.');

            return self::FAILURE;
        }

        $reviewer = null;
        if ($this->option('publish')) {
            $email = (string) $this->option('reviewer');
            $reviewer = $email === ''
                ? null
                : User::query()->where('email', $email)->where('is_staff', true)->first();

            if ($reviewer === null) {
                $this->error('Publishing needs --reviewer=<active staff email>.');

                return self::FAILURE;
            }
        }

        $created = 0;
        $updated = 0;
        $failures = [];

        foreach ($manifest['talks'] as $entry) {
            try {
                $result = $this->importOne($root, $entry, $reviewer);
                $result === 'create' ? $created++ : $updated++;
                $this->line(sprintf('  %-6s %s', $result, $entry['slug']));
            } catch (Throwable $exception) {
                $failures[] = $entry['slug'].': '.$exception->getMessage();
                $this->error('  failed '.$entry['slug'].': '.$exception->getMessage());
            }
        }

        $this->newLine();
        $this->info(sprintf('created %d, updated %d, failed %d', $created, $updated, count($failures)));

        if ($failures !== []) {
            foreach ($failures as $failure) {
                $this->line('  - '.$failure);
            }

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function importOne(string $root, array $entry, ?User $reviewer): string
    {
        $slug = (string) ($entry['slug'] ?? '');
        if ($slug === '' || ! is_file($root.'/'.($entry['final'] ?? ''))) {
            throw new \RuntimeException('Missing slug or final.json.');
        }

        $content = json_decode((string) file_get_contents($root.'/'.$entry['final']), true);
        $segments = TedContent::segments($content['paragraphs'] ?? null);
        $words = TedContent::words($content['words'] ?? null);

        $topic = null;
        $topicSlug = (string) ($entry['topic_slug'] ?? '');
        if ($topicSlug !== '') {
            $topic = Topic::query()->where('slug', $topicSlug)->first();
            if ($topic === null) {
                throw new \RuntimeException("Unknown topic {$topicSlug}.");
            }

            $conflict = TedTalk::query()
                ->where('topic_id', $topic->id)
                ->where('slug', '!=', $slug)
                ->first();
            if ($conflict !== null) {
                throw new \RuntimeException("Topic {$topicSlug} already has {$conflict->slug}.");
            }
        }

        $talk = TedTalk::query()->where('slug', $slug)->first() ?? new TedTalk(['slug' => $slug]);

        if (! is_file($root.'/'.$entry['audio'])) {
            throw new \RuntimeException('Missing audio file.');
        }

        $audioBytes = (string) file_get_contents($root.'/'.$entry['audio']);
        $audioPath = 'ted/'.$slug.'-'.substr(hash('sha256', $audioBytes), 0, 12).'.mp3';

        $coverPath = null;
        $coverBytes = null;
        if (($entry['cover'] ?? '') !== '') {
            if (! is_file($root.'/'.$entry['cover'])) {
                throw new \RuntimeException('Missing cover file.');
            }
            $coverBytes = (string) file_get_contents($root.'/'.$entry['cover']);
            $coverPath = 'ted/'.$slug.'-'.substr(hash('sha256', $coverBytes), 0, 10).'.jpg';
        }

        if ($this->option('dry-run')) {
            $this->line(sprintf(
                '    dry-run: %s -> topic %s, %d paragraphs, %d words',
                $slug,
                $topicSlug !== '' ? $topicSlug : 'pool',
                count($segments),
                count($words),
            ));

            return $talk->exists ? 'update' : 'create';
        }

        return DB::transaction(function () use ($talk, $entry, $topic, $segments, $words, $audioBytes, $audioPath, $coverBytes, $coverPath, $reviewer): string {
            $oldAudio = $talk->audio_path;
            $oldCover = $talk->cover_path;
            $creating = ! $talk->exists;

            Storage::disk('local')->put($audioPath, $audioBytes);

            if ($coverPath !== null) {
                Storage::disk('public')->put($coverPath, $coverBytes);
                CoverImage::reencode($coverPath);
            }

            $publishing = $reviewer !== null;

            $talk->fill([
                'topic_id' => $topic?->id,
                'title_en' => (string) $entry['title_en'],
                'speaker' => (string) ($entry['speaker'] ?? ''),
                'area' => (string) $entry['area'],
                'duration_seconds' => (int) $entry['duration_seconds'],
                'audio_path' => $audioPath,
                'cover_path' => $coverPath,
                'segments' => $segments,
                'words' => $words,
                'source_url' => (string) $entry['source_url'],
                'source_license' => (string) ($entry['source_license'] ?? 'CC BY-NC-ND 4.0'),
                'license_note' => $entry['license_note'] ?? null,
                'status' => $publishing ? 'published' : 'draft',
                'published_at' => $publishing ? now() : null,
                'reviewed_by' => $publishing ? $reviewer->id : null,
                'reviewed_at' => $publishing ? now() : null,
            ]);
            $talk->save();

            if ($oldAudio !== null && $oldAudio !== '' && $oldAudio !== $audioPath) {
                Storage::disk('local')->delete($oldAudio);
            }
            if ($oldCover !== null && $oldCover !== '' && $oldCover !== $coverPath) {
                Storage::disk('public')->delete($oldCover);
            }

            return $creating ? 'create' : 'update';
        });
    }
}
