import { z } from "zod";

export const SynopsisSchema = z.object({
  // 한 문장 요약 (logline). 영상 1편의 정체성.
  logline: z.string().min(20).max(200),
  // 0~15초 안에 시청자를 잡는 후크 문장.
  hook: z.string().min(10).max(200),
  // 시청자가 가져갈 핵심 takeaway 3개.
  takeaways: z.array(z.string().min(5)).length(3),
  // 타겟 시청자 묘사 (예: "우주 과학에 관심 있는 일반 시청자").
  audience: z.string().min(3),
  // 목표 분량(분).
  duration_min: z.number().int().min(5).max(20),
  // 톤 메모 (예: "단정적, 격앙 X, 사례 중심").
  tone_notes: z.string().optional(),
});

export type Synopsis = z.infer<typeof SynopsisSchema>;
