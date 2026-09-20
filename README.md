# Pathfinders Voice for Aged Care

A working demo that turns bounded PCA-to-RN briefings and RN-to-RN handovers into structured, source-linked evidence mapped to Australia’s National Aged Care Quality Indicators.

## What works

- Browser-based voice recording with one press to start and one press to stop
- Interactive provenance between every evidence item and its transcript source
- Real server-side audio transcription with speaker diarisation
- Robust hidden matching to three precomputed demonstration analyses
- Evidence mapped against the current 11-indicator NQI set
- Clear RN-review and non-clinical-advice boundaries

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add an OpenAI API key as `OPENAI_API_KEY` to enable live uploads.
3. Run `pnpm dev`.

Without an API key, the voice interface remains visible but transcription cannot run.

The demo intentionally does not persist recordings or extracted records. Retention, consent, clinical-record integration, and multi-resident disambiguation remain out of scope.
