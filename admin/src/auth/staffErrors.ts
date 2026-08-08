// admin/src/auth/staffErrors.ts
// Safe Persian error mapping for the Admin login. PocketBase internals are
// never surfaced: invalid credentials and disabled accounts collapse into
// one neutral message; only genuine service unavailability is
// distinguished (when it is safe to do so).

export function staffLoginErrorMessage(err: unknown): string {
  // The SDK names errors "ClientResponseError <status>" (status appended).
  const isSdkError = err instanceof Error && err.name.startsWith('ClientResponseError');
  if (isSdkError) {
    const e = err as Error & { status?: number };
    if (e.status === 0 || e.status === undefined) {
      return 'سرویس در دسترس نیست. بعداً دوباره تلاش کنید.';
    }
    // 400/401/403: wrong credentials, inactive or unverified account.
    return 'ایمیل یا رمز عبور نادرست است.';
  }
  return 'سرویس در دسترس نیست. بعداً دوباره تلاش کنید.';
}
