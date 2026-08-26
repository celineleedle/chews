import { mkdtemp, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ByteDiskCache } from "../places/diskCache.js";

const bytesOf = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;
const textOf = (bytes: ArrayBuffer): string => new TextDecoder().decode(bytes);

describe("ByteDiskCache", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "chews-disk-cache-test-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes and content type", async () => {
    const cache = new ByteDiskCache(dir, 60_000, 10);
    await cache.set("photo:800", { bytes: bytesOf("jpeg-bytes"), contentType: "image/jpeg" });

    const hit = await cache.get("photo:800");
    expect(hit).toBeDefined();
    expect(hit!.contentType).toBe("image/jpeg");
    expect(textOf(hit!.bytes)).toBe("jpeg-bytes");
    expect(await cache.get("other-key")).toBeUndefined();
  });

  it("survives a 'restart' — a new instance over the same dir reads the entry", async () => {
    const first = new ByteDiskCache(dir, 60_000, 10);
    await first.set("map:1.2345,-6.7890:640", { bytes: bytesOf("png"), contentType: "image/png" });

    const second = new ByteDiskCache(dir, 60_000, 10);
    const hit = await second.get("map:1.2345,-6.7890:640");
    expect(hit?.contentType).toBe("image/png");
    expect(textOf(hit!.bytes)).toBe("png");
  });

  it("treats an entry older than the TTL as a miss and deletes it", async () => {
    const cache = new ByteDiskCache(dir, 60_000, 10);
    await cache.set("k", { bytes: bytesOf("x"), contentType: "image/png" });

    // Age the file past the TTL by rewinding its mtime.
    const [name] = await readdir(dir);
    const file = path.join(dir, name!);
    const old = new Date(Date.now() - 120_000);
    await utimes(file, old, old);

    expect(await cache.get("k")).toBeUndefined();
    await expect.poll(() => stat(file).then(() => true, () => false)).toBe(false);
  });
});
