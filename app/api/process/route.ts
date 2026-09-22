import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type DiarizedSegment = {
  speaker?: string;
  start?: number;
  end?: number;
  text?: string;
};

type DiarizedTranscript = {
  duration?: number;
  segments?: DiarizedSegment[];
};

type TranscriptSegment = {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
};

const SUPPORTED_INDICATORS = [
  'Pressure injuries',
  'Incontinence care',
  'Falls and major injury',
  'Activities of daily living',
  'Consumer experience',
  'Quality of life',
] as const;

type ModelClaim = {
  observation: string;
  detail: string;
  type: 'direct' | 'inferred' | 'absence';
  indicator: (typeof SUPPORTED_INDICATORS)[number];
  confidence: number;
  sourceSegmentId: string;
};

type ModelAnalysis = {
  residentRoom: number | null;
  residentName: string | null;
  speakerRole: 'PCA' | 'RN';
  conversationType: 'PCA to RN briefing' | 'RN to RN handover' | 'Care note';
  noMatchReason: string | null;
  claims: ModelClaim[];
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const RESIDENTS = [
  { name: 'Eliza Doyle', roomNumber: 20, wing: 'Banksia Wing' },
  { name: 'Beth Jones', roomNumber: 41, wing: 'Jacaranda Wing' },
  { name: 'Jake Smith', roomNumber: 6, wing: 'Wattle Wing' },
  { name: 'Amina Rahman', roomNumber: 12, wing: 'Banksia Wing' },
  { name: 'George Wilson', roomNumber: 9, wing: 'Wattle Wing' },
  { name: 'Mei Chen', roomNumber: 33, wing: 'Jacaranda Wing' },
  { name: 'Rosa Marino', roomNumber: 27, wing: 'Banksia Wing' },
] as const;

const ANALYSIS_SCHEMA = {
  name: 'care_evidence_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      residentRoom: { type: ['integer', 'null'] },
      residentName: { type: ['string', 'null'] },
      speakerRole: { type: 'string', enum: ['PCA', 'RN'] },
      conversationType: {
        type: 'string',
        enum: ['PCA to RN briefing', 'RN to RN handover', 'Care note'],
      },
      noMatchReason: { type: ['string', 'null'] },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            observation: { type: 'string' },
            detail: { type: 'string' },
            type: {
              type: 'string',
              enum: ['direct', 'inferred', 'absence'],
            },
            indicator: { type: 'string', enum: SUPPORTED_INDICATORS },
            confidence: { type: 'integer', minimum: 55, maximum: 99 },
            sourceSegmentId: { type: 'string' },
          },
          required: [
            'observation',
            'detail',
            'type',
            'indicator',
            'confidence',
            'sourceSegmentId',
          ],
        },
      },
    },
    required: [
      'residentRoom',
      'residentName',
      'speakerRole',
      'conversationType',
      'noMatchReason',
      'claims',
    ],
  },
} as const;

const SYSTEM_PROMPT = `You extract evidence from short Australian aged-care voice notes for a proof-of-concept demonstration.

Return only claims that are explicitly supported by the supplied transcript segments. Map each claim to exactly one of these supported National Quality Indicator demo categories:

- Pressure injuries: repositioning, pressure-area care, skin or pressure-site inspection, pressure damage or preventative measures.
- Incontinence care: continence, toileting frequency or assistance, bladder/bowel observations, pads, accidents, or relevant fluid-intake changes.
- Falls and major injury: falls, near falls, unsteadiness, mobility risks, unsafe or increased unassisted movement, or increased toileting-related movement that creates a plausible falls risk.
- Activities of daily living: eating, bathing, dressing, toileting, transferring, mobility, or participation in routine activities.
- Consumer experience: expressed preferences, choice, respect, complaints, satisfaction, social participation or withdrawal.
- Quality of life: mood, engagement, isolation, sustained withdrawal, meaningful activity or wellbeing.

Rules:
1. Break the transcript into useful atomic claims. Do not duplicate the same fact.
2. Use "direct" for something observed or performed, "absence" for something expected that did not happen, and "inferred" only for a reasonable risk or pattern derived from the words.
3. Every claim must cite one exact sourceSegmentId from the input. Never invent an ID or quote.
4. Do not force a match. If there is no supported care evidence, return an empty claims array and a short noMatchReason.
5. Negation matters. "No redness" is an observed absence of redness, not redness being present.
6. Confidence is a demo mapping-strength score: 95-99 for an explicit, unambiguous statement; 85-94 for a clear mapping with slight interpretation; 70-84 for a reasonable inference; 55-69 for an ambiguous mapping worth review. Omit anything weaker than 55.
7. Resolve the resident only from a room number or name actually present. Known demo residents are: Eliza Doyle room 20; Beth Jones room 41; Jake Smith room 6; Amina Rahman room 12; George Wilson room 9; Mei Chen room 33; Rosa Marino room 27.
8. Keep observation titles concise and details to one sentence. Do not provide advice or diagnoses.`;

function getApiKey() {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
}

function getAnalysisModel() {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return (
    workerEnv.OPENAI_ANALYSIS_MODEL ??
    process.env.OPENAI_ANALYSIS_MODEL ??
    'gpt-4o-mini'
  );
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function resolveResident(analysis: ModelAnalysis) {
  if (analysis.residentRoom !== null) {
    const byRoom = RESIDENTS.find(
      (resident) => resident.roomNumber === analysis.residentRoom,
    );
    if (byRoom) return byRoom;
  }

  if (analysis.residentName) {
    const modelName = normalize(analysis.residentName);
    const byName = RESIDENTS.find((resident) => {
      const knownName = normalize(resident.name);
      return knownName === modelName || knownName.includes(modelName);
    });
    if (byName) return byName;
  }

  return null;
}

function currentShift(hour: number) {
  if (hour < 12) return 'Morning shift';
  if (hour < 17) return 'Afternoon shift';
  return 'Evening shift';
}

async function analyseTranscript(
  apiKey: string,
  segments: TranscriptSegment[],
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getAnalysisModel(),
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            transcriptSegments: segments.map(({ id, speaker, text }) => ({
              id,
              speaker,
              text,
            })),
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ANALYSIS_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(
      'Care evidence analysis failed:',
      response.status,
      detail.slice(0, 500),
    );
    throw new Error('analysis_failed');
  }

  const completion = (await response.json()) as ChatCompletionResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('analysis_empty');
  return JSON.parse(content) as ModelAnalysis;
}

export async function POST(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return jsonError(
      'Voice transcription has not been configured for this demo yet.',
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('The voice recording could not be read.', 400);
  }

  const audio = form.get('audio');
  if (!(audio instanceof File) || audio.size === 0)
    return jsonError('No voice recording was received.', 400);
  if (audio.size > 24 * 1024 * 1024)
    return jsonError('Please keep the recording under 24 MB.', 413);

  const transcriptionBody = new FormData();
  transcriptionBody.append('file', audio, audio.name || 'care-recording.webm');
  transcriptionBody.append('model', 'gpt-4o-transcribe-diarize');
  transcriptionBody.append('response_format', 'diarized_json');
  transcriptionBody.append('chunking_strategy', 'auto');
  transcriptionBody.append('language', 'en');

  const transcriptionResponse = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: transcriptionBody,
    },
  );

  if (!transcriptionResponse.ok) {
    const detail = await transcriptionResponse.text();
    console.error(
      'Transcription failed:',
      transcriptionResponse.status,
      detail.slice(0, 500),
    );
    return jsonError(
      'We could not transcribe that recording. Please try again in a quieter space.',
      502,
    );
  }

  const transcript = (await transcriptionResponse.json()) as DiarizedTranscript;
  const segments = (transcript.segments ?? [])
    .filter(
      (
        segment,
      ): segment is Required<
        Pick<DiarizedSegment, 'speaker' | 'start' | 'end' | 'text'>
      > &
        DiarizedSegment =>
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

  if (segments.length === 0)
    return jsonError('No clear speech was detected. Please record again.', 422);

  let analysis: ModelAnalysis;
  try {
    analysis = await analyseTranscript(apiKey, segments);
  } catch {
    return jsonError(
      'The transcript was captured, but its care evidence could not be analysed. Please try again.',
      502,
    );
  }

  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const evidence = analysis.claims.flatMap((claim, index) => {
    const source = segmentById.get(claim.sourceSegmentId);
    if (!source || !SUPPORTED_INDICATORS.includes(claim.indicator)) return [];

    return [
      {
        id: `evidence-${index + 1}`,
        observation: claim.observation.trim(),
        detail: claim.detail.trim(),
        type: claim.type,
        indicator: claim.indicator,
        confidence: Math.max(55, Math.min(99, Math.round(claim.confidence))),
        quote: source.text,
        sourceSegmentId: source.id,
      },
    ];
  });

  const resident = resolveResident(analysis);
  const now = new Date();
  const timeParts = new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  }).formatToParts(now);
  const recordedAt = `${timeParts.find((part) => part.type === 'hour')?.value ?? '00'}:${timeParts.find((part) => part.type === 'minute')?.value ?? '00'}`;
  const sydneyHour = Number(
    timeParts.find((part) => part.type === 'hour')?.value ?? 0,
  );
  const roomLabel = resident
    ? `Room ${resident.roomNumber} · ${resident.wing}`
    : analysis.residentRoom
      ? `Room ${analysis.residentRoom}`
      : 'Resident not identified';

  return Response.json({
    record: {
      caseLabel: 'Voice recording',
      resident:
        resident?.name ?? analysis.residentName ?? 'Resident not identified',
      room: roomLabel,
      shift: currentShift(sydneyHour),
      recordedAt,
      duration: formatDuration(
        transcript.duration ?? segments.at(-1)?.end ?? 0,
      ),
      conversationType: analysis.conversationType,
      noMatchReason:
        evidence.length === 0
          ? (analysis.noMatchReason ??
            'No evidence matched the supported quality indicators.')
          : null,
      segments: segments.map((segment) => ({
        ...segment,
        role: analysis.speakerRole,
      })),
      evidence,
    },
  });
}
