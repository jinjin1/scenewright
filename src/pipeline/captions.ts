import path from "node:path";
import type { Script } from "../schemas/script.js";
import type { Storyboard } from "../schemas/storyboard.js";

export interface SrtCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

// shot.audio_ref(예: "assets/audio/scene01-line01.wav") → line id ("scene01-line01")
function lineIdFromAudioRef(audioRef: string): string {
  return path.basename(audioRef, path.extname(audioRef));
}

// 화면 표기 정규화 — 발화는 한글 음차("깃"·"클로드 코드"·"깃허브")로 읽지만, 화면(자막·카드)에는
// 영어 고유명사로 표기한다(운영자 지침: "스크립트로 깃이라고 읽되 화면에선 Git", "CC가 아니라
// Claude Code"). TTS는 line.text(한글)를 그대로 쓰므로 오디오에는 영향이 없고, 자막 렌더에만 적용.
// 한글 단어 충돌(깃발·옷깃·깃털·깃들다·깃대·깃봉)은 lookbehind/lookahead로 배제한다.
function normalizeScreenTerms(text: string): string {
  return text
    .replace(/깃허브/g, "GitHub")
    .replace(/클로드\s*코드/g, "Claude Code")
    .replace(/(?<!옷)깃(?![발털들든듦대봉])/g, "Git");
}

// 화면 자막용 텍스트 변환. TTS 입력은 script.text(콤마 등 발화 페이싱 부호 포함)이지만,
// 자막은 그 부호가 시각적으로 어색하므로 제거한다. 마침표·물음표·느낌표는 가독성에
// 기여하므로 유지. 화면 고유명사는 normalizeScreenTerms로 영어 표기(깃→Git 등).
//
// 규칙:
// - 화면 표기: 깃→Git, 깃허브→GitHub, 클로드 코드→Claude Code (발화는 한글 유지)
// - `,` (콤마, 발화 쉼표) → 공백
// - `...` / `…` (생략 부호) → 공백
// - `—` (em dash) → 공백
// - 다중 공백은 하나로
export function toCaption(text: string): string {
  return normalizeScreenTerms(text)
    .replace(/,\s*/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/…/g, " ")
    .replace(/—/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// storyboard의 각 shot을 SRT cue로 변환. duration_sec 누적으로 timestamp.
// 매칭되는 script line의 text를 자막용으로 정제(`toCaption`)하여 사용.
// line이 없으면 빈 텍스트(누락 cue로 보존).
export function buildCues(storyboard: Storyboard, script: Script): SrtCue[] {
  const lineById = new Map(script.lines.map((l) => [l.id, l]));
  const cues: SrtCue[] = [];
  let cursor = 0;
  storyboard.shots.forEach((shot, i) => {
    const start = cursor;
    const end = cursor + shot.duration_sec;
    cursor = end;
    const id = lineIdFromAudioRef(shot.audio_ref);
    const rawText = lineById.get(id)?.text ?? "";
    cues.push({
      index: i + 1,
      startSec: start,
      endSec: end,
      text: toCaption(rawText),
    });
  });
  return cues;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

export function formatSrt(cues: SrtCue[]): string {
  return (
    cues
      .map(
        (c) =>
          `${c.index}\n${formatSrtTimestamp(c.startSec)} --> ${formatSrtTimestamp(c.endSec)}\n${c.text}\n`,
      )
      .join("\n") + "\n"
  );
}
