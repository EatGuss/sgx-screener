import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * File-based raw-response cache for Yahoo calls. Keyed by ingestion `asOf`
 * date so a re-run on the same day reuses cached payloads without hitting
 * the network again. Lives under `backend/.cache/yahoo/` (gitignored).
 */
export class YahooResponseCache {
  constructor(
    private readonly baseDir: string,
    private readonly asOf: string,
    private readonly enabled = true,
  ) {}

  private filePath(key: string): string {
    return join(this.baseDir, this.asOf, key);
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fetcher();

    const path = this.filePath(key);
    try {
      const raw = await readFile(path, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      // cache miss or corrupt file — fetch and write
    }

    const data = await fetcher();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data), "utf-8");
    return data;
  }
}

export const DEFAULT_CACHE_DIR = join(process.cwd(), ".cache", "yahoo");
