import type {
  Storyboard,
  StoryboardShot,
  TransitionName,
} from "../../schemas/storyboard.js";

// shot.duration_sec × fps → 정수 프레임 수 누적. 최소 1프레임 보장.
export function calculateTotalFrames(storyboard: Storyboard): number {
  const fps = storyboard.meta.fps;
  return storyboard.shots.reduce(
    (sum, shot) => sum + Math.max(1, Math.round(shot.duration_sec * fps)),
    0,
  );
}

// 각 shot의 누적 시작 프레임. Episode 컴포지션이 <Sequence from=...> 계산에 사용.
export function shotStartFrames(storyboard: Storyboard): number[] {
  const fps = storyboard.meta.fps;
  const starts: number[] = [];
  let cursor = 0;
  for (const shot of storyboard.shots) {
    starts.push(cursor);
    cursor += Math.max(1, Math.round(shot.duration_sec * fps));
  }
  return starts;
}

export type VisualGroup = {
  startIndex: number; // 그룹에 속한 첫 shot의 storyboard.shots index
  startFrame: number; // composition 시작 기준 누적 프레임
  durationInFrames: number; // 그룹 전체 길이
  shots: StoryboardShot[]; // 그룹에 속한 shot들. 모두 동일 visual
  shotStartFrames: number[]; // 각 shot의 group 시작 기준 오프셋 프레임
  representative: StoryboardShot; // 그룹의 visual (component + props). 모든 shot이 동일
};

// component + props가 연속해서 동일한 shot들을 한 그룹으로 묶는다.
// carry-forward 해소 후 storyboard에서 같은 visual이 여러 shot에 복제되어 있으면
// React가 Sequence 경계마다 unmount/remount → animation 재시작 → "반짝" 깜빡임 발생.
// 같은 visual은 한 번만 마운트하고 그 안에서 Audio만 shot별로 바꾸기 위한 그룹핑.
export function groupConsecutiveByVisual(storyboard: Storyboard): VisualGroup[] {
  const fps = storyboard.meta.fps;
  const groups: VisualGroup[] = [];
  let cursor = 0;
  let index = 0;

  const visualKey = (shot: StoryboardShot): string =>
    `${shot.component}:${JSON.stringify(shot.props)}`;

  for (const shot of storyboard.shots) {
    const frames = Math.max(1, Math.round(shot.duration_sec * fps));
    const last = groups[groups.length - 1];

    if (last && visualKey(last.representative) === visualKey(shot)) {
      last.shotStartFrames.push(last.durationInFrames);
      last.shots.push(shot);
      last.durationInFrames += frames;
    } else {
      groups.push({
        startIndex: index,
        startFrame: cursor,
        durationInFrames: frames,
        shots: [shot],
        shotStartFrames: [0],
        representative: shot,
      });
    }
    cursor += frames;
    index += 1;
  }
  return groups;
}

export type StockSegment = {
  src: string;
  from: number; // 그룹 시작 기준 프레임
  durationInFrames: number;
};

// 한 visual 그룹(연속 StockBg)을 자산 컷 세그먼트로 분해한다.
// 그룹 내 각 shot의 span을, 그 shot이 보유한 자산 수와 minHoldFrames에 맞춰
// 1~N개 세그먼트로 나눈다 (자산 1개당 최소 minHoldFrames는 보장).
// 자산이 없는 span은 직전(없으면 이후) 자산으로 채워 hold한다.
// 그룹 전체에 자산이 하나도 없으면 빈 배열 반환 → 호출자가 LineCard로 폴백.
export function buildStockSegments(
  group: VisualGroup,
  srcByShot: Record<string, string[]>,
  minHoldFrames: number,
): StockSegment[] {
  const segs: StockSegment[] = [];

  group.shots.forEach((_, j) => {
    const from = group.shotStartFrames[j] ?? 0;
    const to = group.shotStartFrames[j + 1] ?? group.durationInFrames;
    const span = Math.max(1, to - from);
    const assets = srcByShot[String(group.startIndex + j)] ?? [];

    if (assets.length === 0) {
      segs.push({ src: "", from, durationInFrames: span });
      return;
    }

    const maxByHold = Math.max(1, Math.floor(span / Math.max(1, minHoldFrames)));
    const n = Math.min(assets.length, maxByHold);
    const base = Math.floor(span / n);
    for (let i = 0; i < n; i++) {
      const dur = i === n - 1 ? span - base * (n - 1) : base;
      segs.push({ src: assets[i]!, from: from + base * i, durationInFrames: dur });
    }
  });

  // 빈 src(자산 없는 span) 채우기: 직전 자산 hold.
  let last = "";
  for (const s of segs) {
    if (s.src) last = s.src;
    else if (last) s.src = last;
  }
  // 선행 빈 span은 첫 자산으로 backfill. 자산이 전혀 없으면 빈 배열.
  const firstSrc = segs.find((s) => s.src)?.src ?? "";
  if (!firstSrc) return [];
  for (const s of segs) if (!s.src) s.src = firstSrc;

  return segs;
}

// meta.transition 정책. "varied" = 경계별 전환을 shot.transition_in(CC가 내용 보고
// 고름)으로 결정 + 폴백. none/fade/wipe = 영상 전체 단일 고정(back-compat).
export type TransitionKind = "none" | "fade" | "wipe" | "varied";

/**
 * 각 그룹 경계(group i ↔ i+1)에서 실제로 쓸 전환 이름을 해소한다 (null = 하드 컷).
 * 레이아웃(tail 유무)과 presentation 선택의 **단일 진실원** — 둘이 어긋나지 않게.
 *
 * - "none": 모든 경계 컷.
 * - "fade"/"wipe": 모든 경계 단일 고정 (back-compat).
 * - "varied": 새 그룹(i+1)의 representative.transition_in을 CC가 정한 값으로 사용.
 *   생략 시 폴백 — scene 바뀌면 "fade"(차분한 기본), 같은 scene이면 null(컷).
 *   "none"으로 명시하면 컷. → 전환이 내용에 맞고, 남발 없이 섹션 위주로 절제됨.
 *
 * 반환 길이 = max(0, groups.length - 1). i번째 = 그룹 i 뒤 전환.
 */
export function resolveBoundaryTransitions(
  groups: VisualGroup[],
  transition: TransitionKind,
): (TransitionName | null)[] {
  const out: (TransitionName | null)[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    if (transition === "none") {
      out.push(null);
    } else if (transition === "fade" || transition === "wipe") {
      out.push(transition);
    } else {
      // "varied" — CC가 새 그룹에 정한 transition_in, 없으면 폴백.
      const explicit = groups[i + 1]!.representative.transition_in;
      if (explicit) {
        out.push(explicit === "none" ? null : explicit);
      } else {
        const crossScene =
          groups[i]!.representative.scene_id !== groups[i + 1]!.representative.scene_id;
        out.push(crossScene ? "fade" : null);
      }
    }
  }
  return out;
}

export type GroupTransitionLayout = {
  startIndex: number; // group.startIndex (편의상 carry)
  contentFrames: number; // g_k — 그룹의 실제 콘텐츠 길이
  // TransitionSeries.Sequence에 넘길 길이 = g_k + (뒤따르는 전환 D_k). 마지막 그룹은 g.
  seqDuration: number;
  // 이 그룹 뒤에 들어갈 전환 길이 D_k (클램프됨). 마지막/none이면 0.
  transitionAfter: number;
};

export type TransitionLayout = {
  groups: GroupTransitionLayout[];
  totalFrames: number; // = ∑ contentFrames (전환이 총 길이를 바꾸지 않음)
};

/**
 * 시각 그룹들을 TransitionSeries 레이아웃으로 변환한다.
 *
 * 전환은 인접 시퀀스를 D만큼 겹치게 해 타임라인을 줄이므로, 그대로 쓰면 절대
 * 오디오/자막이 시각보다 앞당겨진다. 이를 막기 위해 각 비-마지막 그룹 시퀀스 길이를
 * `g_k + D_k`로 늘린다. 그러면 TransitionSeries 내 그룹 i의 절대 시작이
 * `∑_{k<i}(g_k+D_k) − ∑_{k<i}D_k = ∑_{k<i}g_k`로 원래 절대 시작과 정렬되고,
 * 총 길이도 `∑(g_k+D_k) − ∑D_k = ∑g_k`로 보존된다 (`calculateTotalFrames` 불변).
 *
 * D_k는 `min(baseFrames, ⌊g_k/2⌋, ⌊g_{k+1}/2⌋)`로 클램프 — 짧은 그룹에서 전환이
 * 콘텐츠를 삼키거나 연속 전환이 겹치지 않도록(Remotion 제약: 전환 길이 ≤ 인접 시퀀스).
 */
export function buildTransitionLayout(
  groups: VisualGroup[],
  transition: TransitionKind,
  baseFrames: number,
): TransitionLayout {
  const n = groups.length;
  const out: GroupTransitionLayout[] = [];
  let totalFrames = 0;

  // 경계별 전환 해소 (단일 진실원). null이면 컷 → tail 0.
  const names = resolveBoundaryTransitions(groups, transition);

  for (let i = 0; i < n; i++) {
    const g = groups[i]!.durationInFrames;
    totalFrames += g;

    let d = 0;
    if (i < n - 1 && names[i] != null) {
      const next = groups[i + 1]!.durationInFrames;
      d = Math.max(0, Math.min(baseFrames, Math.floor(g / 2), Math.floor(next / 2)));
    }

    out.push({
      startIndex: groups[i]!.startIndex,
      contentFrames: g,
      seqDuration: g + d,
      transitionAfter: d,
    });
  }

  return { groups: out, totalFrames };
}
