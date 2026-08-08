// shared/authstore-isolation.test.ts
// Podcast Slice 1 — separate PocketBase Client/AuthStore instances for the
// Student and Admin builds. Each origin keeps its own session: the Student
// app uses the SDK default `pocketbase_auth` key, the Admin uses its own
// `fep_staff_auth` key, and neither imports the other's client module.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Student/Admin AuthStore isolation', () => {
  it('student client keeps the SDK default storage key and never creates a second store', () => {
    const studentClient = read('app/src/lib/pocketbase.ts');
    expect(studentClient).toMatch(/new PocketBase\(origin\)/);
    expect(studentClient).not.toMatch(/LocalAuthStore/);
  });

  it('admin client uses a dedicated staff storage key', () => {
    const adminClient = read('admin/src/auth/pocketbase.ts');
    expect(adminClient).toContain("STAFF_AUTH_STORAGE_KEY = 'fep_staff_auth'");
    expect(adminClient).toMatch(/new LocalAuthStore\(STAFF_AUTH_STORAGE_KEY\)/);
  });

  it('student code never imports the admin client and vice versa', () => {
    expect(read('app/src/lib/pocketbase.ts')).not.toMatch(/admin\/src/);
    expect(read('admin/src/auth/pocketbase.ts')).not.toMatch(/app\/src/);
  });

  it('admin token refresh targets the staff_admins collection', () => {
    const adminAuth = read('admin/src/auth/staffAuth.tsx');
    expect(adminAuth).toContain('pb.collection(STAFF_COLLECTION).authRefresh()');
    expect(read('admin/src/auth/pocketbase.ts')).toContain(
      "export const STAFF_COLLECTION = 'staff_admins'",
    );
  });
});
