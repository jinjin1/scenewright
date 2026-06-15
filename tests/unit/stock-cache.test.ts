import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cacheDir, cacheKey, download, ensureInPool, poolDir } from "../../src/pipeline/stock/cache.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

// cache.ts의 경로는 모두 cwd 기준(assets/stock/pool, episodes/<slug>/...)이라, 임시 디렉터리로
// chdir해 레포를 오염시키지 않고 격리한다. afterAll에서 원복(파일 단위로 순차 실행되어 안전).
const ORIG = process.cwd();
let TMP: string;
beforeAll(() => {
  TMP = mkdtempSync(path.join(tmpdir(), "cache-"));
  process.chdir(TMP);
});
afterAll(() => {
  process.chdir(ORIG);
});

function media(id: string, opts: Partial<MediaResult> = {}): MediaResult {
  return {
    provider: "pexels",
    id,
    url: `u/${id}`,
    // 실제로 fetch되면 안 되는 URL — 자가 시드/풀 히트면 절대 호출되지 않아야 한다.
    download_url: "http://stock.invalid/should-not-be-fetched",
    thumb_url: `t/${id}`,
    width: 1920,
    height: 1080,
    photographer: "x",
    photographer_url: "y",
    license_note: "z",
    ...opts,
  };
}

function poolFiles(): string[] {
  const p = poolDir();
  return existsSync(p) ? readdirSync(p).filter((f) => !f.endsWith(".tmp")) : [];
}

describe("ensureInPool", () => {
  it("로컬 파일을 풀에 복사하고 poolRelPath를 돌려준다 (provider-cacheKey 명명)", async () => {
    const src = path.join(TMP, "src1.jpg");
    writeFileSync(src, "imgdata");
    const r = await ensureInPool(media("a1"), src);
    expect(r.hit).toBe(false);
    expect(existsSync(path.resolve(r.poolRelPath))).toBe(true);
    expect(r.poolRelPath).toBe(`assets/stock/pool/pexels-${cacheKey(media("a1"))}.jpg`);
  });

  it("두 번째 호출은 hit=true (멱등 — 재복사 안 함, 같은 경로)", async () => {
    const src = path.join(TMP, "src2.jpg");
    writeFileSync(src, "imgdata");
    const a = await ensureInPool(media("a2"), src);
    const before = poolFiles().length;
    const b = await ensureInPool(media("a2"), src);
    expect(a.hit).toBe(false);
    expect(b.hit).toBe(true);
    expect(b.poolRelPath).toBe(a.poolRelPath);
    expect(poolFiles().length).toBe(before); // 새 파일 안 생김
  });

  it("같은 (provider,id)는 콘텐츠 주소가 같아 소스가 달라도 한 파일로 dedup된다", async () => {
    const s1 = path.join(TMP, "x1.jpg");
    const s2 = path.join(TMP, "x2.jpg");
    writeFileSync(s1, "one");
    writeFileSync(s2, "two");
    const a = await ensureInPool(media("dup"), s1);
    const b = await ensureInPool(media("dup"), s2);
    expect(b.hit).toBe(true);
    expect(b.poolRelPath).toBe(a.poolRelPath);
  });
});

describe("download 자가 시드 (풀 미스 + 에피소드 파일 존재)", () => {
  it("에피소드에 이미 받아둔 파일이 있으면 네트워크 없이 풀을 시드하고 hit=true", async () => {
    const slug = "selfseed";
    const m = media("seed99");
    // 옛 download가 남긴 것처럼 에피소드 캐시에 파일을 미리 심는다(풀은 비어 있음).
    const dir = cacheDir(slug);
    mkdirSync(dir, { recursive: true });
    const prefix = `${m.provider}-${cacheKey(m)}`;
    writeFileSync(path.join(dir, `${prefix}.jpg`), "episode-bytes");
    expect(poolFiles()).not.toContain(`${prefix}.jpg`); // 풀엔 아직 없음

    // download_url이 invalid라, 자가 시드가 안 되면 fetch가 터진다(= 테스트 실패로 회귀 감지).
    const dl = await download(m, slug);
    expect(dl.hit).toBe(true); // 네트워크 안 탐
    expect(dl.poolRelPath).toBeDefined();
    expect(existsSync(path.resolve(dl.poolRelPath!))).toBe(true); // 풀이 시드됨
    expect(dl.relPath).toBe(`episodes/${slug}/assets/stock/${prefix}.jpg`);
  });

  it("풀 히트면 두 번째 에피소드도 네트워크 없이 복사만 한다", async () => {
    const m = media("shared7");
    // 첫 에피소드: 에피소드 파일로 시드 → 풀에 적재.
    const dirA = cacheDir("epa");
    mkdirSync(dirA, { recursive: true });
    const prefix = `${m.provider}-${cacheKey(m)}`;
    writeFileSync(path.join(dirA, `${prefix}.jpg`), "bytes");
    await download(m, "epa");

    // 둘째 에피소드: 풀 히트 → 무네트워크 복사.
    const dl = await download(m, "epb");
    expect(dl.hit).toBe(true);
    expect(dl.relPath).toBe(`episodes/epb/assets/stock/${prefix}.jpg`);
    expect(existsSync(path.resolve(dl.relPath))).toBe(true);
  });
});
