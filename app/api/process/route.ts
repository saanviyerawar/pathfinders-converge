import { env } from 'cloudflare:workers';

export const runtime = 'edge';

const QUALITY_INDICATORS = [
  'Pressure injuries',
  'Physical restraint',
  'Unplanned weight loss',
  'Falls and major injury',
  'Medication management',
  'Activities of daily living',
  'Incontinence care',
  'Hospitalisation',
  'Workforce',
  'Consumer experience',
  'Quality of life',
] as const;

type DiarizedSegment = {
  id?: string;
  speaker?: string;
  start?: number;
  end?: number;
  text?: string;
};

type DiarizedTranscript = {
  duration?: number;
  text?: string;
  segments?: DiarizedSegment[];
};

type Extraction = {
  resident: string;
  room: string;
  shift: string;
  recordedAt: string;
  conversationType: string;
  speakerRoles: Array<{ speaker: string; role: string }>;
  evidence: Array<{
    observation: string;
    detail: string;
    type: 'direct' | 'inferred' | 'absence';
    indicator: (typeof QUALITY_INDICATORS)[number];
    confidence: number;
    quote: string;
    sourceSegmentId: string;
  }>;
};

function getRuntimeValue(key: string) {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv[key] ?? process.env[key];
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function transcriptTextFromResponse(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function normalizeQuote(value: string) {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  const apiKey = getRuntimeValue('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonError(
      'Live audio processing needs an OpenAI API key. The three scripted demo cases remain fully available.',
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Upload a valid audio file.', 400);
  }

  const audio = form.get('audio');
  if (!(audio instanceof File)) return jsonError('No audio file was received.', 400);
  if (audio.size === 0) return jsonError('The audio file is empty.', 400);
  if (audio.size > 24 * 1024 * 1024) return jsonError('Please upload an audio file smaller than 24 MB.', 413);

  const transcriptionBody = new FormData();
  transcriptionBody.append('file', audio, audio.name || 'care-recording.webm');
  transcriptionBody.append('model', 'gpt-4o-transcribe-diarize');
  transcriptionBody.append('response_format', 'diarized_json');
  transcriptionBody.append('chunking_strategy', 'auto');
  transcriptionBody.append('language', 'en');

  const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: transcriptionBody,
  });

  if (!transcriptionResponse.ok) {
    const message = await transcriptionResponse.text();
    console.error('Transcription failed:', transcriptionResponse.status, message.slice(0, 500));
    return jsonError('Transcription failed. Check the audio format and API configuration, then try again.', 502);
  }

  const transcript = (await transcriptionResponse.json()) as DiarizedTranscript;
  const segments = (transcript.segments ?? [])
    .filter((segment): segment is Required<Pick<DiarizedSegment, 'speaker' | 'start' | 'end' | 'text'>> & DiarizedSegment =>
      typeof segment.speaker === 'string' &&
      typeof segment.start === 'number' &&
      typeof segment.end === 'number' &&
      typeof segment.text === 'string' &&
      segment.text.trim().length > 0,
    )
    .map((segment, index) => ({
      id: `segment-${index + 1}`,
      speaker: segment.speaker,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    }));

  if (segments.length === 0) return jsonError('No speech could be identified in that recording.', 422);

  const transcriptForModel = segments
    .map((segment) => `[${segment.id}] ${segment.speaker} (${segment.start.toFixed(1)}-${segment.end.toFixed(1)}s): ${segment.text}`)
    .join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      resident: { type: 'string', description: 'Resident name or reference exactly as spoken; use Resident not identified if absent.' },
      room: { type: 'string', description: 'Location exactly as supported by the transcript; use Location not stated if absent.' },
      shift: { type: 'string', description: 'Shift or time context; use Shift not stated if absent.' },
      recordedAt: { type: 'string', description: 'Time stated in the conversation; use Time not stated if absent.' },
      conversationType: { type: 'string', enum: ['PCA → RN briefing', 'RN → RN handover', 'Care conversation'] },
      speakerRoles: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            speaker: { type: 'string' },
            role: { type: 'string', enum: ['PCA', 'RN', 'Unknown'] },
          },
          required: ['speaker', 'role'],
        },
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            observation: { type: 'string' },
            detail: { type: 'string' },
            type: { type: 'string', enum: ['direct', 'inferred', 'absence'] },
            indicator: { type: 'string', enum: QUALITY_INDICATORS },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            quote: { type: 'string', description: 'An exact, contiguous quote copied verbatim from one transcript segment.' },
            sourceSegmentId: { type: 'string', description: 'The bracketed segment id that contains the exact quote.' },
          },
          required: ['observation', 'detail', 'type', 'indicator', 'confidence', 'quote', 'sourceSegmentId'],
        },
      },
    },
    required: ['resident', 'room', 'shift', 'recordedAt', 'conversationType', 'speakerRoles', 'evidence'],
  };

  const extractionResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getRuntimeValue('OPENAI_EXTRACTION_MODEL') || 'gpt-5-mini',
      instructions: [
        'You extract evidence from Australian residential aged-care briefings and handovers.',
        'Return only claims supported by the transcript. Never invent a diagnosis, event, task, time, place, or resident identity.',
        'Every evidence item must include one exact contiguous quote from its source segment and the matching segment id.',
        'Distinguish direct observations, cautious inferences, and absence/non-occurrence signals.',
        'Map only to the supplied official National Aged Care Quality Indicator names.',
        'Use lower confidence for inferences. The output is for RN review and must not contain clinical advice.',
      ].join(' '),
      input: transcriptForModel,
      text: {
        format: {
          type: 'json_schema',
          name: 'care_evidence_record',
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!extractionResponse.ok) {
    const message = await extractionResponse.text();
    console.error('Extraction failed:', extractionResponse.status, message.slice(0, 500));
    return jsonError('The transcript was created, but structured evidence extraction failed. Please try again.', 502);
  }

  const rawExtraction = (await extractionResponse.json()) as Record<string, unknown>;
  const outputText = transcriptTextFromResponse(rawExtraction);
  if (!outputText) return jsonError('The extraction response did not contain structured evidence.', 502);

  let extraction: Extraction;
  try {
    extraction = JSON.parse(outputText) as Extraction;
  } catch {
    return jsonError('The extraction response could not be read.', 502);
  }

  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const speakerRole = new Map(extraction.speakerRoles.map((item) => [item.speaker, item.role]));
  const evidence = extraction.evidence
    .filter((item) => {
      const source = segmentById.get(item.sourceSegmentId);
      return source && normalizeQuote(source.text).includes(normalizeQuote(item.quote));
    })
    .map((item, index) => ({ ...item, id: `evidence-${index + 1}` }));

  if (evidence.length === 0) {
    return jsonError('No source-verifiable care evidence was found in this recording.', 422);
  }

  return Response.json({
    record: {
      caseLabel: 'Uploaded recording',
      resident: extraction.resident,
      room: extraction.room,
      shift: extraction.shift,
      recordedAt: extraction.recordedAt,
      duration: formatDuration(transcript.duration ?? segments.at(-1)?.end ?? 0),
      conversationType: extraction.conversationType,
      segments: segments.map((segment) => ({
        ...segment,
        role: speakerRole.get(segment.speaker) ?? 'Unknown',
      })),
      evidence,
    },
  });
}
