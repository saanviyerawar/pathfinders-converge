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

type EvidenceTemplate = {
  observation: string;
  detail: string;
  type: 'direct' | 'inferred' | 'absence';
  indicator: string;
  confidence: number;
  sourceWords: string[];
};

type DemoPattern = {
  resident: string;
  room: string;
  shift: string;
  conversationType: string;
  speakerRole: 'PCA' | 'RN';
  signalGroups: string[][];
  evidence: EvidenceTemplate[];
};

const DEMO_PATTERNS: DemoPattern[] = [
  {
    resident: 'Eliza Doyle',
    room: 'Room 20 · Banksia Wing',
    shift: 'Morning shift',
    conversationType: 'PCA → RN briefing',
    speakerRole: 'PCA',
    signalGroups: [
      ['room 20', 'room twenty'],
      ['repositioned', 'positioned', 'turned'],
      ['doyle', 'doil', 'doyl'],
      ['left side', 'left'],
      ['sacrum', 'sacral'],
      ['intact'],
      ['redness', 'red'],
    ],
    evidence: [
      {
        observation: 'Repositioning performed',
        detail: 'Resident repositioned onto her left side.',
        type: 'direct',
        indicator: 'Pressure injuries',
        confidence: 98,
        sourceWords: ['repositioned', 'positioned', 'turned', 'left'],
      },
      {
        observation: 'Skin inspection performed',
        detail: 'Sacrum checked; skin reported intact with no redness.',
        type: 'direct',
        indicator: 'Pressure injuries',
        confidence: 97,
        sourceWords: ['sacrum', 'sacral', 'skin', 'intact', 'redness'],
      },
    ],
  },
  {
    resident: 'Beth Jones',
    room: 'Room 41 · Jacaranda Wing',
    shift: 'Afternoon shift',
    conversationType: 'PCA → RN briefing',
    speakerRole: 'PCA',
    signalGroups: [
      ['room 41', 'room forty one', 'room forty-one'],
      ['drinking', 'drank'],
      ['three bottles', '3 bottles', 'bottles'],
      ['toilet', 'bathroom'],
      ['twice', 'two times'],
      ['lunch'],
    ],
    evidence: [
      {
        observation: 'Increased fluid intake',
        detail: 'Three bottles consumed today; described as more than usual.',
        type: 'direct',
        indicator: 'Incontinence care',
        confidence: 94,
        sourceWords: ['drinking', 'drank', 'bottles'],
      },
      {
        observation: 'Increased toileting frequency',
        detail: 'Two toilet visits reported since lunch.',
        type: 'direct',
        indicator: 'Incontinence care',
        confidence: 96,
        sourceWords: ['toilet', 'bathroom', 'twice', 'lunch'],
      },
      {
        observation: 'Mobilisation-related falls risk',
        detail:
          'More frequent trips may increase exposure to falls risk; RN review required.',
        type: 'inferred',
        indicator: 'Falls and major injury',
        confidence: 76,
        sourceWords: ['toilet', 'bathroom', 'twice'],
      },
    ],
  },
  {
    resident: 'Jake Smith',
    room: 'Room 6 · Wattle Wing',
    shift: 'Morning handover',
    conversationType: 'RN → RN handover',
    speakerRole: 'RN',
    signalGroups: [
      ['room 6', 'room six'],
      ['morning activity', 'activity'],
      ['third day', 'three days', '3 days'],
      ['did not come out', "didn't come out", 'not come out'],
      ['eaten', 'ate'],
      ['room'],
    ],
    evidence: [
      {
        observation: 'Non-participation in activities',
        detail: 'Morning activity missed for a third consecutive day.',
        type: 'absence',
        indicator: 'Activities of daily living',
        confidence: 96,
        sourceWords: ['activity', 'third', 'three days'],
      },
      {
        observation: 'Possible social withdrawal pattern',
        detail:
          'Repeated non-participation and eating in-room indicate a pattern for RN review.',
        type: 'inferred',
        indicator: 'Consumer experience',
        confidence: 82,
        sourceWords: ['eaten', 'ate', 'room'],
      },
      {
        observation: 'Quality-of-life signal',
        detail:
          'Reduced engagement across three days may affect quality of life.',
        type: 'inferred',
        indicator: 'Quality of life',
        confidence: 78,
        sourceWords: ['activity', 'third', 'three days'],
      },
    ],
  },
];

function getApiKey() {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function patternScore(text: string, pattern: DemoPattern) {
  const matched = pattern.signalGroups.filter((group) =>
    group.some((signal) => text.includes(signal)),
  ).length;
  return matched / pattern.signalGroups.length;
}

function findPattern(text: string) {
  const normalized = normalize(text);
  const ranked = DEMO_PATTERNS.map((pattern) => ({
    pattern,
    score: patternScore(normalized, pattern),
  })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.38 ? ranked[0].pattern : null;
}

function bestSource(
  segments: Array<{
    id: string;
    speaker: string;
    start: number;
    end: number;
    text: string;
  }>,
  keywords: string[],
) {
  return [...segments].sort((a, b) => {
    const aText = normalize(a.text);
    const bText = normalize(b.text);
    const aScore = keywords.filter((word) => aText.includes(word)).length;
    const bScore = keywords.filter((word) => bText.includes(word)).length;
    return bScore - aScore;
  })[0];
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
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

  const fullTranscript = segments.map((segment) => segment.text).join(' ');
  const pattern = findPattern(fullTranscript);
  if (!pattern) {
    return jsonError(
      'No supported care observation was recognised in this recording. Please try again.',
      422,
    );
  }

  const mappedSegments = segments.map((segment) => ({
    ...segment,
    role: pattern.speakerRole,
  }));
  const evidence = pattern.evidence.map((item, index) => {
    const source = bestSource(segments, item.sourceWords) ?? segments[0];
    return {
      id: `evidence-${index + 1}`,
      observation: item.observation,
      detail: item.detail,
      type: item.type,
      indicator: item.indicator,
      confidence: item.confidence,
      quote: source.text,
      sourceSegmentId: source.id,
    };
  });

  const now = new Date();
  const recordedAt = new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  }).format(now);

  return Response.json({
    record: {
      caseLabel: 'Voice recording',
      resident: pattern.resident,
      room: pattern.room,
      shift: pattern.shift,
      recordedAt,
      duration: formatDuration(
        transcript.duration ?? segments.at(-1)?.end ?? 0,
      ),
      conversationType: pattern.conversationType,
      segments: mappedSegments,
      evidence,
    },
  });
}
