# Pathfinders Voice for Aged Care

A working demo that turns bounded PCA-to-RN briefings and RN-to-RN handovers into structured, source-linked evidence mapped to Australia’s National Aged Care Quality Indicators.

## What works

- Three scripted cases covering direct observation, inferred risk, and absence as a signal
- Interactive provenance between every evidence item and its transcript source
- Real server-side audio transcription with speaker diarisation
- Structured extraction against the current 11-indicator NQI set
- Exact-quote verification before an extracted claim is shown
- Clear RN-review and non-clinical-advice boundaries

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add an OpenAI API key as `OPENAI_API_KEY` to enable live uploads.
3. Run `pnpm dev`.

Without an API key, the scripted cases remain fully usable and audio upload returns a clear configuration message.

The demo intentionally does not persist recordings or extracted records. Retention, consent, clinical-record integration, and multi-resident disambiguation remain out of scope.
