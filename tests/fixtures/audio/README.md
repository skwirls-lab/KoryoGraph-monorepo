# Audio fixtures

Both files are short **synthetic tones** (ffmpeg `sine`), not recordings of people. They exercise the real
upload → ffmpeg → transcription → action board path; the transcripts they "transcribe" to are hand-authored
`transcribe` fixtures keyed to each file's sha256 (no OpenRouter key in the build environment) and are labelled
"dev fixture" in the UI.

- `class-short.wav` — the action-board spec's class (`tests/fixtures/action-board.ts`).
- `demo-class.wav` — the demo seed's recorded class (`tests/fixtures/demo-class.ts`).
