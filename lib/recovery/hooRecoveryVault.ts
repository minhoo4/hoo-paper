"use client";

/*
 * HOO Recovery Vault v1
 *
 * 목표:
 * - Supabase 장애/소실이 발생해도 브라우저에 남은 HOO 데이터를 한 곳에서 찾을 수 있게 한다.
 * - 기존 localStorage / IndexedDB 데이터를 지우거나 덮어쓰지 않는다.
 * - Auth access/refresh token, 비밀번호는 복구 데이터에 저장하지 않는다.
 * - 서버에서 읽어온 중요 데이터(profile, wallet, world state 등)는 별도 IndexedDB에 복제한다.
 */

export type HooRecoveryScope =
  | "identity"
  | "profile"
  | "daily-journal"
  | "world-player"
  | "world-wallet"
  | "world-item"
  | "world-field"
  | "world-delivery"
  | "local-storage"
  | "study-note"
  | "generic";

export type HooRecoveryRecord<T = unknown> = {
  id: string;
  scope: HooRecoveryScope;
  key: string;
  value: T;
  updatedAt: string;
  source: string;
  version: 1;
};

export type HooRecoveryBundle = {
  format: "hoo-recovery-bundle";
  version: 1;
  exportedAt: string;
  origin: string;
  localStorage: Record<string, string>;
  vaultRecords: HooRecoveryRecord[];
  studyNoteIndexedDb: Record<string, unknown[]> | null;
};

const RECOVERY_DB_NAME = "hoo-recovery-vault-v1";
const RECOVERY_DB_VERSION = 1;
const RECOVERY_STORE = "records";
const RECOVERY_FALLBACK_PREFIX = "hoo-recovery-fallback:";
const LOCAL_STORAGE_SNAPSHOT_KEY = "all-hoo-local-storage";
const STUDY_NOTE_DB_NAME = "hoo-study-note-db";

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function buildId(scope: HooRecoveryScope, key: string) {
  return `${scope}:${key}`;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // JSON fallback below.
    }
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

async function openRecoveryDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    throw new Error("Recovery Vault is available only in the browser.");
  }

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      RECOVERY_DB_NAME,
      RECOVERY_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
        const store = database.createObjectStore(RECOVERY_STORE, {
          keyPath: "id",
        });

        store.createIndex("scope", "scope", {
          unique: false,
        });

        store.createIndex("updatedAt", "updatedAt", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("HOO Recovery Vault를 열 수 없습니다."));
    request.onblocked = () =>
      reject(new Error("HOO Recovery Vault 업그레이드가 차단되었습니다."));
  });
}

function writeFallbackRecord(record: HooRecoveryRecord) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      `${RECOVERY_FALLBACK_PREFIX}${record.id}`,
      JSON.stringify(record),
    );
  } catch {
    // localStorage까지 사용할 수 없는 환경에서는 조용히 포기한다.
  }
}

function readFallbackRecord<T>(scope: HooRecoveryScope, key: string) {
  if (typeof window === "undefined") {
    return null as HooRecoveryRecord<T> | null;
  }

  try {
    const raw = window.localStorage.getItem(
      `${RECOVERY_FALLBACK_PREFIX}${buildId(scope, key)}`,
    );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as HooRecoveryRecord<T>;
  } catch {
    return null;
  }
}

export async function saveRecoveryRecord<T>(
  scope: HooRecoveryScope,
  key: string,
  value: T,
  source = "hoo-app",
) {
  const record: HooRecoveryRecord<T> = {
    id: buildId(scope, key),
    scope,
    key,
    value: cloneValue(value),
    updatedAt: new Date().toISOString(),
    source,
    version: 1,
  };

  if (!isBrowser()) {
    return record;
  }

  try {
    const database = await openRecoveryDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          RECOVERY_STORE,
          "readwrite",
        );

        transaction.objectStore(RECOVERY_STORE).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(
            transaction.error ??
              new Error("HOO Recovery Vault 저장에 실패했습니다."),
          );
        transaction.onabort = () =>
          reject(
            transaction.error ??
              new Error("HOO Recovery Vault 저장이 중단되었습니다."),
          );
      });
    } finally {
      database.close();
    }
  } catch (error) {
    console.warn("HOO Recovery Vault IndexedDB 저장 실패, localStorage 보조 저장을 사용합니다.", error);
    writeFallbackRecord(record);
  }

  return record;
}

export async function loadRecoveryRecord<T>(
  scope: HooRecoveryScope,
  key: string,
): Promise<HooRecoveryRecord<T> | null> {
  if (!isBrowser()) {
    return null;
  }

  try {
    const database = await openRecoveryDb();

    try {
      const result = await new Promise<HooRecoveryRecord<T> | null>(
        (resolve, reject) => {
          const transaction = database.transaction(
            RECOVERY_STORE,
            "readonly",
          );

          const request = transaction
            .objectStore(RECOVERY_STORE)
            .get(buildId(scope, key));

          request.onsuccess = () =>
            resolve(
              (request.result as HooRecoveryRecord<T> | undefined) ?? null,
            );
          request.onerror = () =>
            reject(
              request.error ??
                new Error("HOO Recovery Vault 읽기에 실패했습니다."),
            );
        },
      );

      return result ?? readFallbackRecord<T>(scope, key);
    } finally {
      database.close();
    }
  } catch {
    return readFallbackRecord<T>(scope, key);
  }
}

export async function loadRecoveryScope<T = unknown>(
  scope: HooRecoveryScope,
): Promise<HooRecoveryRecord<T>[]> {
  if (!isBrowser()) {
    return [];
  }

  try {
    const database = await openRecoveryDb();

    try {
      return await new Promise<HooRecoveryRecord<T>[]>((resolve, reject) => {
        const transaction = database.transaction(
          RECOVERY_STORE,
          "readonly",
        );
        const store = transaction.objectStore(RECOVERY_STORE);
        const index = store.index("scope");
        const request = index.getAll(IDBKeyRange.only(scope));

        request.onsuccess = () =>
          resolve(
            Array.isArray(request.result)
              ? (request.result as HooRecoveryRecord<T>[])
              : [],
          );
        request.onerror = () =>
          reject(
            request.error ??
              new Error("HOO Recovery Vault 범위 읽기에 실패했습니다."),
          );
      });
    } finally {
      database.close();
    }
  } catch {
    return [];
  }
}

export function readHooLocalStorage(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const result: Record<string, string> = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key || !key.startsWith("hoo-")) {
      continue;
    }

    // Recovery fallback 자체는 다시 snapshot 안에 중첩하지 않는다.
    if (key.startsWith(RECOVERY_FALLBACK_PREFIX)) {
      continue;
    }

    const value = window.localStorage.getItem(key);

    if (value !== null) {
      result[key] = value;
    }
  }

  return result;
}

export async function captureHooLocalStorageSnapshot() {
  return await saveRecoveryRecord(
    "local-storage",
    LOCAL_STORAGE_SNAPSHOT_KEY,
    readHooLocalStorage(),
    "localStorage-mirror",
  );
}

export async function restoreHooLocalStorageSnapshot(options?: {
  overwrite?: boolean;
}) {
  if (typeof window === "undefined") {
    return 0;
  }

  const record = await loadRecoveryRecord<Record<string, string>>(
    "local-storage",
    LOCAL_STORAGE_SNAPSHOT_KEY,
  );

  if (!record?.value || typeof record.value !== "object") {
    return 0;
  }

  let restoredCount = 0;

  for (const [key, value] of Object.entries(record.value)) {
    if (!key.startsWith("hoo-")) {
      continue;
    }

    if (
      options?.overwrite !== true &&
      window.localStorage.getItem(key) !== null
    ) {
      continue;
    }

    window.localStorage.setItem(key, value);
    restoredCount += 1;
  }

  return restoredCount;
}

async function databaseExists(name: string) {
  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof indexedDbWithDatabases.databases !== "function") {
    return true;
  }

  try {
    const databases = await indexedDbWithDatabases.databases();
    return databases.some((database) => database.name === name);
  } catch {
    return true;
  }
}

async function readExistingIndexedDb(
  databaseName: string,
): Promise<Record<string, unknown[]> | null> {
  if (!isBrowser()) {
    return null;
  }

  if (!(await databaseExists(databaseName))) {
    return null;
  }

  return await new Promise<Record<string, unknown[]> | null>((resolve) => {
    const request = indexedDB.open(databaseName);

    request.onerror = () => resolve(null);

    request.onsuccess = async () => {
      const database = request.result;

      try {
        const result: Record<string, unknown[]> = {};
        const storeNames = Array.from(database.objectStoreNames);

        for (const storeName of storeNames) {
          result[storeName] = await new Promise<unknown[]>((storeResolve) => {
            try {
              const transaction = database.transaction(storeName, "readonly");
              const getAllRequest = transaction.objectStore(storeName).getAll();

              getAllRequest.onsuccess = () =>
                storeResolve(
                  Array.isArray(getAllRequest.result)
                    ? getAllRequest.result
                    : [],
                );
              getAllRequest.onerror = () => storeResolve([]);
            } catch {
              storeResolve([]);
            }
          });
        }

        resolve(result);
      } finally {
        database.close();
      }
    };
  });
}

async function readAllVaultRecords(): Promise<HooRecoveryRecord[]> {
  if (!isBrowser()) {
    return [];
  }

  try {
    const database = await openRecoveryDb();

    try {
      return await new Promise<HooRecoveryRecord[]>((resolve, reject) => {
        const transaction = database.transaction(
          RECOVERY_STORE,
          "readonly",
        );
        const request = transaction.objectStore(RECOVERY_STORE).getAll();

        request.onsuccess = () =>
          resolve(
            Array.isArray(request.result)
              ? (request.result as HooRecoveryRecord[])
              : [],
          );
        request.onerror = () =>
          reject(
            request.error ??
              new Error("HOO Recovery Vault 전체 읽기에 실패했습니다."),
          );
      });
    } finally {
      database.close();
    }
  } catch {
    return [];
  }
}

export async function createHooRecoveryBundle(): Promise<HooRecoveryBundle> {
  await captureHooLocalStorageSnapshot();

  const [vaultRecords, studyNoteIndexedDb] = await Promise.all([
    readAllVaultRecords(),
    readExistingIndexedDb(STUDY_NOTE_DB_NAME),
  ]);

  return {
    format: "hoo-recovery-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    origin:
      typeof window !== "undefined"
        ? window.location.origin
        : "",
    localStorage: readHooLocalStorage(),
    vaultRecords,
    studyNoteIndexedDb,
  };
}

export async function downloadHooRecoveryBundle() {
  if (typeof window === "undefined") {
    return;
  }

  const bundle = await createHooRecoveryBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `hoo-recovery-${date}.json`;
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function restoreStudyNoteIndexedDb(
  stores: Record<string, unknown[]> | null,
) {
  if (!stores || !isBrowser()) {
    return 0;
  }

  if (!(await databaseExists(STUDY_NOTE_DB_NAME))) {
    return 0;
  }

  return await new Promise<number>((resolve) => {
    const request = indexedDB.open(STUDY_NOTE_DB_NAME);

    request.onerror = () => resolve(0);
    request.onsuccess = async () => {
      const database = request.result;
      let restored = 0;

      try {
        for (const [storeName, records] of Object.entries(stores)) {
          if (!database.objectStoreNames.contains(storeName)) {
            continue;
          }

          restored += await new Promise<number>((storeResolve) => {
            try {
              const transaction = database.transaction(storeName, "readwrite");
              const store = transaction.objectStore(storeName);
              let count = 0;

              for (const record of records) {
                try {
                  store.put(record);
                  count += 1;
                } catch {
                  // 개별 손상 레코드는 건너뛴다.
                }
              }

              transaction.oncomplete = () => storeResolve(count);
              transaction.onerror = () => storeResolve(0);
              transaction.onabort = () => storeResolve(0);
            } catch {
              storeResolve(0);
            }
          });
        }
      } finally {
        database.close();
      }

      resolve(restored);
    };
  });
}

export async function importHooRecoveryBundle(
  bundle: HooRecoveryBundle,
  options?: {
    overwriteLocalStorage?: boolean;
  },
) {
  if (
    !bundle ||
    bundle.format !== "hoo-recovery-bundle" ||
    bundle.version !== 1
  ) {
    throw new Error("지원하지 않는 HOO 복구 파일입니다.");
  }

  if (typeof window === "undefined") {
    return {
      localStorage: 0,
      vault: 0,
      studyNotes: 0,
    };
  }

  let localStorageCount = 0;

  for (const [key, value] of Object.entries(bundle.localStorage ?? {})) {
    if (!key.startsWith("hoo-")) {
      continue;
    }

    if (
      options?.overwriteLocalStorage !== true &&
      window.localStorage.getItem(key) !== null
    ) {
      continue;
    }

    window.localStorage.setItem(key, value);
    localStorageCount += 1;
  }

  let vaultCount = 0;

  for (const record of bundle.vaultRecords ?? []) {
    if (
      !record ||
      typeof record.scope !== "string" ||
      typeof record.key !== "string"
    ) {
      continue;
    }

    await saveRecoveryRecord(
      record.scope,
      record.key,
      record.value,
      `import:${record.source ?? "unknown"}`,
    );
    vaultCount += 1;
  }

  const studyNotes = await restoreStudyNoteIndexedDb(
    bundle.studyNoteIndexedDb,
  );

  await captureHooLocalStorageSnapshot();

  return {
    localStorage: localStorageCount,
    vault: vaultCount,
    studyNotes,
  };
}
