import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PYTHON_BIN = path.join(REPO_ROOT, "python/.venv/bin/python");
const SYNTH_SCRIPT = path.join(REPO_ROOT, "python/synthesize.py");

export interface TTSLine {
  id: string;
  text: string;
}

export interface SynthesisResult {
  id: string;
  path: string;
}

export interface TTSProvider {
  synthesize(lines: TTSLine[], outDir: string): Promise<SynthesisResult[]>;
}

export interface SupertonicConfig {
  voice: string;
  totalSteps: number;
  speed: number;
  lang: string;
}

export const SUPERTONIC_DEFAULT: SupertonicConfig = {
  voice: "M1",
  totalSteps: 16,
  speed: 1.4,
  lang: "ko",
};

export class SupertonicProvider implements TTSProvider {
  constructor(private readonly config: SupertonicConfig = SUPERTONIC_DEFAULT) {}

  async synthesize(lines: TTSLine[], outDir: string): Promise<SynthesisResult[]> {
    mkdirSync(outDir, { recursive: true });

    const requestPath = path.join(tmpdir(), `supertonic-${process.pid}-${Date.now()}.json`);
    const payload = {
      voice: this.config.voice,
      total_steps: this.config.totalSteps,
      speed: this.config.speed,
      lang: this.config.lang,
      out_dir: outDir,
      lines,
    };
    writeFileSync(requestPath, JSON.stringify(payload));

    await execFileAsync(PYTHON_BIN, [SYNTH_SCRIPT, requestPath], {
      maxBuffer: 1024 * 1024 * 16,
    });

    return lines.map((line) => ({
      id: line.id,
      path: path.join(outDir, `${line.id}.wav`),
    }));
  }
}
