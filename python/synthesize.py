"""
TS pipeline에서 호출되는 Supertonic 합성 브리지.

사용: python synthesize.py <request.json>

request.json 형식:
{
  "voice": "M1",
  "total_steps": 16,
  "speed": 1.0,
  "lang": "ko",
  "out_dir": "/abs/path/to/episodes/<slug>/assets/audio",
  "lines": [{"id": "scene01-line01", "text": "..."}]
}

각 라인의 합성 결과를 out_dir/<id>.wav 로 저장한다.
"""

import json
import os
import sys
import time
from supertonic import TTS


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: synthesize.py <request.json>", file=sys.stderr)
        return 2

    with open(sys.argv[1], encoding="utf-8") as f:
        req = json.load(f)

    out_dir = req["out_dir"]
    os.makedirs(out_dir, exist_ok=True)

    tts = TTS()
    style = tts.get_voice_style(req["voice"])

    # `req.get(key, default)`는 명시적 null이 들어오면 None을 그대로 반환해 default가 무시된다.
    # Supertonic은 None 인자에 대해 런타임 에러를 내므로 None과 missing을 동일 취급.
    def _coalesce(key, default):
        v = req.get(key)
        return default if v is None else v

    total = len(req["lines"])
    for idx, line in enumerate(req["lines"], 1):
        t0 = time.time()
        wav, _ = tts.synthesize(
            line["text"],
            voice_style=style,
            total_steps=_coalesce("total_steps", 16),
            speed=_coalesce("speed", 1.4),
            lang=_coalesce("lang", "ko"),
        )
        out_path = os.path.join(out_dir, f"{line['id']}.wav")
        tts.save_audio(wav, out_path)
        dt = time.time() - t0
        print(f"[{idx}/{total}] {line['id']} ({dt:.1f}s)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
