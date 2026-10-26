<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * One page-range rule for every numbered list.
 *
 * A stale link, browser back, or a filter that shrinks the result set can
 * ask for a page that no longer exists. Rendering that page produces an
 * empty list with no paginator and no way back, so the server redirects to
 * the nearest valid page with the same filters instead. Non-numeric and
 * non-positive page values take the same path.
 */
trait ClampsPagination
{
    protected function redirectOutOfRangePage(Request $request, LengthAwarePaginator $paginator): ?RedirectResponse
    {
        $pageParam = $request->query('page');
        $invalidPage = $pageParam !== null
            && (! is_string($pageParam) || ! ctype_digit($pageParam) || (int) $pageParam < 1);

        if (! $invalidPage && $paginator->currentPage() <= $paginator->lastPage()) {
            return null;
        }

        $target = max(1, min((int) $paginator->currentPage(), $paginator->lastPage()));
        $query = $request->except('page');
        if ($target > 1) {
            $query['page'] = $target;
        }

        $url = $request->url();
        $suffix = http_build_query($query);

        return redirect()->to($suffix === '' ? $url : $url.'?'.$suffix);
    }
}
