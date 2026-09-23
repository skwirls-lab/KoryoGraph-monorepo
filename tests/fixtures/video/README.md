# Video fixtures

- `clip-6s.mp4` — a 6-second synthetic clip (ffmpeg `testsrc2` pattern + tone, H.264/AAC, 480×360). It is **not**
  footage of a person: it exercises the real upload → ffmpeg keyframe extraction → vision task → review path.
  The `technique_feedback` fixture keyed to this file's sha256 is hand-authored (no OpenRouter key in the
  build environment) and is marked "dev fixture" wherever it appears. Regenerate with:

  ```bash
  $(node -e 'console.log(require("ffmpeg-static"))') -f lavfi -i "testsrc2=duration=6:size=480x360:rate=15" \
    -f lavfi -i "sine=frequency=440:duration=6" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 32 \
    -c:a aac -b:a 32k -shortest clip-6s.mp4
  ```
  (Re-encoding changes the sha256; re-run `scripts/fixtures/author-copilot.ts` afterwards.)
