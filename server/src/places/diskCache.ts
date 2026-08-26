import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "../env.js";

export interface CachedBytes {
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * Disk layer under the in-memory byte caches (photos, static maps), so a server
 * restart — every watch-mode reload in dev, every deploy in prod — doesn't turn
 * into a fresh round of billable Google image fetches.
 *
 * One file per entry, named by a hash of the cache key:
 * `u32be contentType length | contentType | image bytes`. Expiry is the file's
 * mtime; writes go through a temp file + rename so a crash can't leave a
 * half-written entry. Every failure path degrades to a cache miss — the disk is
 * an optimization, never a dependency.
 */
export class ByteDiskCache {
  private ready: Promise<boolean>;
  private writes = 0;

  constructor(
    private dir: string,
    private ttlMs: number,
    private maxFiles: number,
  ) {
    this.ready = mkdir(dir, { recursive: true }).then(
      () => {
        void this.sweep();
        return true;
      },
      () => false,
    );
  }

  private fileFor(key: string): string {
    return path.join(this.dir, `${createHash("sha256").update(key).digest("hex")}.bin`);
  }

  async get(key: string): Promise<CachedBytes | undefined> {
    if (!(await this.ready)) return undefined;
    const file = this.fileFor(key);
    try {
      const stats = await stat(file);
      if (Date.now() - stats.mtimeMs >= this.ttlMs) {
        void unlink(file).catch(() => {});
        return undefined;
      }
      const buf = await readFile(file);
      if (buf.length < 4) return undefined;
      const ctLen = buf.readUInt32BE(0);
      if (buf.length < 4 + ctLen) return undefined;
      const body = buf.subarray(4 + ctLen);
      return {
        contentType: buf.subarray(4, 4 + ctLen).toString("utf8"),
        // Standalone ArrayBuffer: don't hold the whole read buffer alive.
        bytes: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      };
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: CachedBytes): Promise<void> {
    if (!(await this.ready)) return;
    const file = this.fileFor(key);
    const ct = Buffer.from(value.contentType, "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(ct.length, 0);
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await writeFile(tmp, Buffer.concat([header, ct, Buffer.from(value.bytes)]));
      await rename(tmp, file);
    } catch {
      await unlink(tmp).catch(() => {});
      return;
    }
    if (++this.writes % 50 === 0) void this.sweep();
  }

  /** Drop expired entries, then the oldest ones past the file cap. */
  private async sweep(): Promise<void> {
    try {
      const now = Date.now();
      const kept: Array<{ file: string; mtimeMs: number }> = [];
      for (const name of await readdir(this.dir)) {
        if (!name.endsWith(".bin")) continue;
        const file = path.join(this.dir, name);
        try {
          const stats = await stat(file);
          if (now - stats.mtimeMs >= this.ttlMs) await unlink(file).catch(() => {});
          else kept.push({ file, mtimeMs: stats.mtimeMs });
        } catch {
          // raced with another delete — fine
        }
      }
      if (kept.length > this.maxFiles) {
        kept.sort((a, b) => a.mtimeMs - b.mtimeMs);
        for (const entry of kept.slice(0, kept.length - this.maxFiles)) {
          await unlink(entry.file).catch(() => {});
        }
      }
    } catch {
      // sweeping is best-effort
    }
  }
}

/**
 * Null when disk caching is off: `BYTE_CACHE_DIR=0`, or under tests (where
 * cross-run persistence would make runs order-dependent) unless a dir is set
 * explicitly.
 */
export function createByteDiskCache(
  subdir: string,
  ttlMs: number,
  maxFiles: number,
): ByteDiskCache | null {
  if (env.BYTE_CACHE_DIR === "0") return null;
  if (env.NODE_ENV === "test" && env.BYTE_CACHE_DIR === "") return null;
  const base = env.BYTE_CACHE_DIR || path.join(tmpdir(), "chews-byte-cache");
  return new ByteDiskCache(path.join(base, subdir), ttlMs, maxFiles);
}
