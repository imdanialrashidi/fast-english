<?php

namespace App\Http\Controllers;

use App\Models\LibraryNode;
use App\Models\ReadingAttempt;
use App\Models\ReadingProgress;
use App\Models\User;
use App\Support\Library\LibraryPresenter;
use App\Support\Library\ReadingPayload;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The reading shelf and its one generic browse/read entry point.
 *
 * `/app/books` is the four-item shelf; every story / IELTS / Inside Reading
 * page below it resolves a library_nodes row by its stable slug. A node with
 * a published document renders the reader; any other node renders its
 * children (or an honest preparing state). The track is URL-friendly
 * (`inside-reading`) while the database key keeps the underscore.
 */
class LibraryController extends Controller
{
    private const TRACKS = [
        'story' => 'story',
        'ielts' => 'ielts',
        'inside-reading' => 'inside_reading',
    ];

    public function index(Request $request): Response
    {
        $this->learner($request);

        return Inertia::render('Books/Index', [
            'collections' => LibraryPresenter::shelf(),
            'tabs' => LibraryPresenter::tabs('all'),
        ]);
    }

    public function track(Request $request, string $track): Response
    {
        return $this->showNode($request, $track, '');
    }

    public function node(Request $request, string $track, string $path): Response
    {
        return $this->showNode($request, $track, $path);
    }

    private function showNode(Request $request, string $track, string $path): Response
    {
        $user = $this->learner($request);

        abort_unless(isset(self::TRACKS[$track]), 404);
        $dbTrack = self::TRACKS[$track];
        $slug = $path === '' ? $track : $track.'/'.$path;

        $node = LibraryNode::query()
            ->where('track', $dbTrack)
            ->where('slug', $slug)
            ->visible()
            ->firstOrFail();

        $document = $node->document()->first();
        $readable = $document !== null && $document->published_at !== null && $node->status === 'published';

        if ($readable) {
            $progress = ReadingProgress::query()
                ->where('user_id', $user->id)
                ->where('node_id', $node->id)
                ->first();

            $attempt = ReadingAttempt::query()
                ->where('user_id', $user->id)
                ->where('node_id', $node->id)
                ->latest('id')
                ->first();

            return Inertia::render('Library/Reader', [
                ...ReadingPayload::forNode($node, $document, $progress, $attempt),
                'tabs' => LibraryPresenter::tabs($dbTrack),
                'track_label' => LibraryPresenter::trackLabel($dbTrack),
            ]);
        }

        $children = $node->children()
            ->visible()
            ->with(['document' => fn ($query) => $query->select('id', 'node_id', 'published_at')])
            ->withCount('children')
            ->get();

        $node->setAttribute('children_count', $children->count());
        $progress = ReadingProgress::query()
            ->where('user_id', $user->id)
            ->whereIn('node_id', $children->pluck('id'))
            ->get()
            ->keyBy('node_id');

        return Inertia::render('Library/Browse', [
            'track' => $track,
            'track_key' => $dbTrack,
            'track_label' => LibraryPresenter::trackLabel($dbTrack),
            'tabs' => LibraryPresenter::tabs($dbTrack),
            'node' => LibraryPresenter::card($node),
            'breadcrumbs' => LibraryPresenter::breadcrumbs($node),
            'children' => $children->map(
                fn (LibraryNode $child): array => LibraryPresenter::card($child, $progress->get($child->id)),
            )->values()->all(),
        ]);
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}
