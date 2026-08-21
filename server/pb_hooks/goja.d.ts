// server/pb_hooks/goja.d.ts
// Goja JSVM globals for server/pb_hooks/*.pb.js — typecheck only.

declare const $app: {
  findRecordById(col: string, id: string): any;
  findRecordsByFilter(
    col: string,
    filter: string,
    sort: string,
    limit: number,
    offset: number,
    params?: Record<string, unknown>,
  ): any[];
  findFirstRecordByFilter(col: string, filter: string, params?: Record<string, unknown>): any;
  findCollectionByNameOrId(col: string): any;
  save(rec: any): void;
  delete(rec: any): void;
  runInTransaction(fn: (txApp: any) => void): void;
  dataDir(): string;
  logger(): { info(m: string): void; error(m: string): void };
  findAuthRecordByToken(token: string, type: string): any;
};
declare const $security: { randomString(len: number): string };
declare const $filepath: { join(...parts: string[]): string; clean(p: string): string };
declare const $os: { readFile(p: string): any };
declare const $apis: { requireAuth(col: string): unknown };
declare function routerAdd(
  method: string,
  path: string,
  handler: (e: any) => any,
  middleware?: any,
): void;
declare function migrate(up: (app: any) => void, down: (app: any) => void): void;
declare const __hooks: string;
// PocketBase Record constructor — use `any` to avoid colliding with TS utility `Record<K,T>`
declare var Record: any;
declare var Collection: any;
declare var TextField: any;
declare var RelationField: any;
declare var SelectField: any;
declare var FileField: any;
declare var NumberField: any;
declare var BoolField: any;
declare var DateField: any;
declare var Dao: any;
declare function onRecordCreate(handler: (e: any) => void, ...collections: string[]): void;
declare function onRecordUpdate(handler: (e: any) => void, ...collections: string[]): void;
declare function onRecordAuthRequest(handler: (e: any) => void, ...collections: string[]): void;
declare function onRecordAuthRefreshRequest(
  handler: (e: any) => void,
  ...collections: string[]
): void;
declare var BadRequestError: any;
declare function toBytes(reader: any, maxBytes: number): any[];
declare function readerToString(body: any): string;
declare var __fepRateLimitModule: any;
declare var EVICT_AT: any;
declare var snapshot: any;
