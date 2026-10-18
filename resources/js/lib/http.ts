/**
 * Shared JSON transport for the learner React surface.
 *
 * Every client save (progress, bookmarks, vocabulary, placement) POSTs to
 * the existing JSON endpoints with the per-session CSRF token from the
 * Inertia root (`resources/views/app.blade.php`); logout stays a native
 * form POST. Status handling, error strings, and retry policy live at
 * the call sites — these helpers only build the request.
 */

export function csrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export async function postJson(url: string, body?: unknown, method = 'POST'): Promise<Response> {
    return fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export async function deleteJson(url: string): Promise<Response> {
    return fetch(url, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
    });
}
