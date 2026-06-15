import { z } from "zod";

export const TreatmentSceneSchema = z.object({
  // 씬 식별자. script/storyboard의 scene_id와 동일 규칙: "scene01", "scene02", ...
  id: z.string().regex(/^scene\d{2,}$/, "id must match /^scene\\d{2,}$/"),
  // 영상 구조에서의 역할 라벨 (예: "Hook", "Problem", "Framework", "Example", "CTA").
  beat: z.string().min(2),
  // 이 씬이 시청자에게 어떤 변화를 만들어야 하는가.
  purpose: z.string().min(5),
  // 목표 길이 (초). 실제 분량은 reconcile 단계에서 TTS 오디오 길이로 보정됨.
  duration_sec: z.number().positive(),
  // 자유 형식 시각 컨셉 메모. script 단계가 이걸 구체 컴포넌트로 풀어냄.
  visual_concept: z.string().min(3),
});

export const TreatmentSchema = z.object({
  scenes: z
    .array(TreatmentSceneSchema)
    .min(3)
    .refine(
      (scenes) => new Set(scenes.map((s) => s.id)).size === scenes.length,
      { message: "scene ids must be unique" },
    ),
});

export type TreatmentScene = z.infer<typeof TreatmentSceneSchema>;
export type Treatment = z.infer<typeof TreatmentSchema>;
