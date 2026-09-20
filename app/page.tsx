'use client';

import { useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  FileAudio,
  LayoutDashboard,
  MapPin,
  Mic2,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  Waves,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Segment = {
  id: string;
  speaker: string;
  role: string;
  start: number;
  end: number;
  text: string;
};

type Evidence = {
  id: string;
  observation: string;
  detail: string;
  type: 'direct' | 'inferred' | 'absence';
  indicator: string;
  confidence: number;
  quote: string;
  sourceSegmentId: string;
};

type CareRecord = {
  caseLabel: string;
  resident: string;
  room: string;
  shift: string;
  recordedAt: string;
  duration: string;
  conversationType: string;
  segments: Segment[];
  evidence: Evidence[];
};

const demoCases: CareRecord[] = [
  {
    caseLabel: 'Direct observation',
    resident: 'Mrs Doyle',
    room: 'Room 18 · Banksia Wing',
    shift: 'Morning shift',
    recordedAt: '09:42',
    duration: '00:12',
    conversationType: 'PCA → RN briefing',
    segments: [
      {
        id: 'd-1',
        speaker: 'Speaker 1',
        role: 'PCA',
        start: 0,
        end: 8.4,
        text: 'I repositioned Mrs Doyle onto her left side, checked her sacrum, skin’s intact, no redness.',
      },
      {
        id: 'd-2',
        speaker: 'Speaker 2',
        role: 'RN',
        start: 8.4,
        end: 11.8,
        text: 'Thanks, I’ll note that for the morning round.',
      },
    ],
    evidence: [
      {
        id: 'd-e1',
        observation: 'Repositioning performed',
        detail: 'Resident repositioned onto left side.',
        type: 'direct',
        indicator: 'Pressure injuries',
        confidence: 98,
        quote: 'I repositioned Mrs Doyle onto her left side',
        sourceSegmentId: 'd-1',
      },
      {
        id: 'd-e2',
        observation: 'Skin inspection performed',
        detail: 'Sacrum checked; skin intact with no redness observed.',
        type: 'direct',
        indicator: 'Pressure injuries',
        confidence: 97,
        quote: 'checked her sacrum, skin’s intact, no redness',
        sourceSegmentId: 'd-1',
      },
    ],
  },
  {
    caseLabel: 'Inferred risk',
    resident: 'Mrs Doyle',
    room: 'Room 18 · Banksia Wing',
    shift: 'Afternoon shift',
    recordedAt: '14:16',
    duration: '00:14',
    conversationType: 'PCA → RN briefing',
    segments: [
      {
        id: 'r-1',
        speaker: 'Speaker 1',
        role: 'PCA',
        start: 0,
        end: 10.6,
        text: 'She’s been drinking a lot more today, got through three bottles, and she’s been up to the toilet twice since lunch.',
      },
      {
        id: 'r-2',
        speaker: 'Speaker 2',
        role: 'RN',
        start: 10.6,
        end: 13.7,
        text: 'Okay, I’ll keep an eye on the change.',
      },
    ],
    evidence: [
      {
        id: 'r-e1',
        observation: 'Increased fluid intake',
        detail: 'Three bottles consumed today; described as more than usual.',
        type: 'direct',
        indicator: 'Incontinence care',
        confidence: 94,
        quote: 'drinking a lot more today, got through three bottles',
        sourceSegmentId: 'r-1',
      },
      {
        id: 'r-e2',
        observation: 'Increased toileting frequency',
        detail: 'Two toilet visits since lunch.',
        type: 'direct',
        indicator: 'Incontinence care',
        confidence: 96,
        quote: 'up to the toilet twice since lunch',
        sourceSegmentId: 'r-1',
      },
      {
        id: 'r-e3',
        observation: 'Mobilisation-related falls risk',
        detail: 'More frequent trips may increase exposure to falls risk; RN review required.',
        type: 'inferred',
        indicator: 'Falls and major injury',
        confidence: 76,
        quote: 'she’s been up to the toilet twice since lunch',
        sourceSegmentId: 'r-1',
      },
    ],
  },
  {
    caseLabel: 'Absence as signal',
    resident: 'Mr Ellis',
    room: 'Room 7 · Wattle Wing',
    shift: 'Morning handover',
    recordedAt: '07:04',
    duration: '00:11',
    conversationType: 'RN → RN handover',
    segments: [
      {
        id: 'a-1',
        speaker: 'Speaker 1',
        role: 'RN',
        start: 0,
        end: 8.9,
        text: 'He didn’t come out for the morning activity again, that’s the third day. He’s just eaten in his room.',
      },
      {
        id: 'a-2',
        speaker: 'Speaker 2',
        role: 'RN',
        start: 8.9,
        end: 11.2,
        text: 'Let’s make sure that gets reviewed today.',
      },
    ],
    evidence: [
      {
        id: 'a-e1',
        observation: 'Non-participation in activities',
        detail: 'Morning activity missed for a third consecutive day.',
        type: 'absence',
        indicator: 'Activities of daily living',
        confidence: 96,
        quote: 'didn’t come out for the morning activity again, that’s the third day',
        sourceSegmentId: 'a-1',
      },
      {
        id: 'a-e2',
        observation: 'Possible social withdrawal pattern',
        detail: 'Repeated non-participation and meals taken in room indicate a pattern for RN review.',
        type: 'inferred',
        indicator: 'Consumer experience',
        confidence: 82,
        quote: 'He’s just eaten in his room',
        sourceSegmentId: 'a-1',
      },
      {
        id: 'a-e3',
        observation: 'Quality-of-life signal',
        detail: 'Reduced engagement across three days may affect quality of life.',
        type: 'inferred',
        indicator: 'Quality of life',
        confidence: 78,
        quote: 'morning activity again, that’s the third day',
        sourceSegmentId: 'a-1',
      },
    ],
  },
];

const navItems = [
  { label: 'Shift overview', icon: LayoutDashboard, active: true },
  { label: 'Residents', icon: UsersRound, active: false },
  { label: 'Quality indicators', icon: Activity, active: false },
];

function formatTime(seconds: number) {
  return `00:${String(Math.round(seconds)).padStart(2, '0')}`;
}

function typeLabel(type: Evidence['type']) {
  if (type === 'direct') return 'Direct observation';
  if (type === 'absence') return 'Absence signal';
  return 'Inferred risk';
}

export default function Home() {
  const [record, setRecord] = useState<CareRecord>(demoCases[0]);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSource = record.evidence.find((item) => item.id === activeEvidence)?.sourceSegmentId;
  const indicators = [...new Set(record.evidence.map((item) => item.indicator))];

  async function uploadRecording(file: File) {
    setProcessing(true);
    setError(null);
    setFileName(file.name);

    try {
      const body = new FormData();
      body.append('audio', file);
      const response = await fetch('/api/process', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The recording could not be processed.');
      setRecord(payload.record as CareRecord);
      setActiveEvidence(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The recording could not be processed.');
    } finally {
      setProcessing(false);
    }
  }

  function chooseDemo(index: number) {
    setRecord(demoCases[index]);
    setActiveEvidence(null);
    setError(null);
    setFileName(null);
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#182625]">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="hidden w-[248px] shrink-0 border-r border-[#dbe5e2] bg-[#0c3a38] text-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="grid size-10 place-items-center rounded-xl bg-[#d8f26a] text-[#163b38] shadow-sm">
              <Waves className="size-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">Pathfinders</p>
              <p className="text-[11px] font-medium text-white/58">Voice for aged care</p>
            </div>
          </div>

          <nav className="space-y-1.5 px-3 py-6" aria-label="Primary navigation">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">Care evidence</p>
            {navItems.map(({ label, icon: Icon, active }) => (
              <button type="button" key={label} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? 'bg-white/12 font-medium text-white' : 'text-white/62 hover:bg-white/7 hover:text-white'}`}>
                <Icon className="size-[18px]" />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4">
            <div className="rounded-xl border border-white/10 bg-white/6 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#d8f26a]">
                <ShieldCheck className="size-4" />
                Evidence-first
              </div>
              <p className="text-xs leading-relaxed text-white/55">Every care claim remains linked to its exact transcript source.</p>
            </div>
            <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left">
              <span className="grid size-9 place-items-center rounded-full bg-[#d8f26a] text-xs font-bold text-[#163b38]">JB</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">James Blissett</span>
                <span className="block truncate text-[11px] text-white/44">Demo facility</span>
              </span>
              <MoreHorizontal className="size-4 text-white/40" />
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#dbe5e2] bg-[#f8faf9]/92 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[#0c3a38] text-[#d8f26a] lg:hidden"><Waves className="size-5" /></div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6f817e]">Oakview Residential Care</p>
                <button type="button" className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
                  Morning shift · 20 September <ChevronDown className="size-4 text-[#6f817e]" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Search"><Search /></Button>
              <Button variant="outline" className="hidden gap-2 sm:flex"><CircleUserRound />RN workspace</Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1420px] px-4 py-6 sm:px-7 xl:px-10 xl:py-8">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#46736f]"><span className="size-2 rounded-full bg-[#4a9b83]" />Shift evidence is up to date</div>
                <h1 className="font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-[30px]">Turn care conversations into evidence</h1>
                <p className="mt-1 max-w-2xl text-sm text-[#667875]">Upload a bounded briefing or handover. Review every mapped observation against the words that produced it.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#667875]"><Clock3 className="size-4" />Last processed 09:42</div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="space-y-5">
                <section className="rounded-2xl border border-[#d9e4e1] bg-white p-5 shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Process a recording</h2>
                      <p className="mt-1 text-xs leading-relaxed text-[#748481]">Audio is processed server-side and returned as reviewable evidence.</p>
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e6f3ef] text-[#26715f]"><Mic2 className="size-[18px]" /></span>
                  </div>

                  <input ref={inputRef} className="hidden" type="file" accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm,.flac" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadRecording(file);
                    event.currentTarget.value = '';
                  }} />
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={processing} className="group flex w-full flex-col items-center rounded-xl border border-dashed border-[#adc5c0] bg-[#f7faf9] px-5 py-7 text-center transition hover:border-[#5b9187] hover:bg-[#f1f7f5] disabled:cursor-wait disabled:opacity-65">
                    <span className="mb-3 grid size-11 place-items-center rounded-full bg-white text-[#24685a] shadow-sm ring-1 ring-[#dbe6e3]">
                      {processing ? <AudioLines className="size-5 animate-pulse" /> : <Upload className="size-5" />}
                    </span>
                    <span className="text-sm font-semibold">{processing ? 'Processing recording…' : 'Upload recording'}</span>
                    <span className="mt-1 text-xs text-[#798a87]">MP3, M4A, WAV or WebM</span>
                    {fileName && <span className="mt-2 max-w-full truncate text-[11px] font-medium text-[#346f64]">{fileName}</span>}
                  </button>

                  {error && <div role="alert" className="mt-3 rounded-lg border border-[#efc6bd] bg-[#fff5f2] px-3 py-2.5 text-xs leading-relaxed text-[#9a4634]">{error}</div>}

                  <div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa8a5]"><span className="h-px flex-1 bg-[#e2e9e7]" />Or run a scripted case<span className="h-px flex-1 bg-[#e2e9e7]" /></div>
                  <div className="space-y-2">
                    {demoCases.map((item, index) => {
                      const selected = record.caseLabel === item.caseLabel && !fileName;
                      return (
                        <button type="button" key={item.caseLabel} onClick={() => chooseDemo(index)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-[#83aea5] bg-[#eef7f4]' : 'border-[#e2e9e7] bg-white hover:border-[#bdcfcb] hover:bg-[#f9fbfa]'}`}>
                          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${selected ? 'bg-[#0c3a38] text-white' : 'bg-[#edf1f0] text-[#6a7c79]'}`}>{index + 1}</span>
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{item.caseLabel}</span><span className="block truncate text-[11px] text-[#71817e]">{item.resident} · {item.conversationType}</span></span>
                          <ArrowRight className={`size-4 ${selected ? 'text-[#2f766a]' : 'text-[#a4b0ae]'}`} />
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#d9e4e1] bg-[#113f3c] p-5 text-white shadow-[0_12px_30px_rgba(20,55,51,0.08)]">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-[#d8f26a]" />Processing trace</div>
                  <div className="mt-5 space-y-0">
                    {[
                      ['Transcribe', 'Speakers separated'],
                      ['Extract', `${record.evidence.length} observations found`],
                      ['Map', `${indicators.length} quality indicators`],
                    ].map(([stage, status], index) => (
                      <div className="grid grid-cols-[24px_1fr] gap-3" key={stage}>
                        <div className="flex flex-col items-center"><span className="grid size-6 place-items-center rounded-full bg-[#d8f26a] text-[#173f3c]"><Check className="size-3.5" strokeWidth={3} /></span>{index < 2 && <span className="h-8 w-px bg-white/18" />}</div>
                        <div className="pb-4"><p className="text-xs font-semibold">{stage}</p><p className="mt-0.5 text-[11px] text-white/50">{status}</p></div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-5">
                <section className="rounded-2xl border border-[#d9e4e1] bg-white shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                  <div className="flex flex-col gap-4 border-b border-[#e1e8e6] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-[#e7f0ee] text-sm font-bold text-[#2d655d]">{record.resident.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight">{record.resident}</h2><Badge variant="secondary" className="bg-[#eef3f2] text-[#506b67]">Needs RN review</Badge></div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#73837f]"><MapPin className="size-3.5" />{record.room}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#6c7d7a] sm:justify-end">
                      <span><strong className="block font-semibold text-[#273c39]">{record.recordedAt}</strong>{record.shift}</span>
                      <span><strong className="block font-semibold text-[#273c39]">{record.duration}</strong>Recording</span>
                      <span><strong className="block font-semibold text-[#273c39]">{record.conversationType}</strong>Conversation</span>
                    </div>
                  </div>

                  <div className="grid divide-y divide-[#e1e8e6] md:grid-cols-3 md:divide-x md:divide-y-0">
                    <div className="p-4 sm:p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7d8d8a]">Evidence captured</p><div className="mt-2 flex items-end gap-2"><strong className="font-heading text-3xl font-semibold tracking-tight">{record.evidence.length}</strong><span className="pb-1 text-xs text-[#6f817d]">reviewable entries</span></div></div>
                    <div className="p-4 sm:p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7d8d8a]">Mapped indicators</p><div className="mt-2 flex flex-wrap gap-1.5">{indicators.map((indicator) => <span key={indicator} className="rounded-md bg-[#eaf4f1] px-2 py-1 text-[11px] font-semibold text-[#2b6d61]">{indicator}</span>)}</div></div>
                    <div className="p-4 sm:p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7d8d8a]">Traceability</p><div className="mt-2 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#eff7dd] text-[#557313]"><ShieldCheck className="size-4" /></span><div><strong className="block text-sm">100% sourced</strong><span className="text-[11px] text-[#73837f]">Every claim linked to speech</span></div></div></div>
                  </div>
                </section>

                <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(430px,1.1fr)]">
                  <section className="overflow-hidden rounded-2xl border border-[#d9e4e1] bg-white shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                    <div className="flex items-center justify-between border-b border-[#e1e8e6] px-5 py-4">
                      <div><h3 className="text-sm font-semibold">Source transcript</h3><p className="mt-0.5 text-[11px] text-[#7a8a87]">Select an evidence card to locate its source.</p></div>
                      <Badge variant="outline" className="border-[#d9e4e1] text-[#5f7470]"><FileAudio /> English (AU)</Badge>
                    </div>
                    <div className="max-h-[580px] space-y-2 overflow-y-auto p-4 sm:p-5">
                      {record.segments.map((segment) => {
                        const highlighted = activeSource === segment.id;
                        return (
                          <button type="button" key={segment.id} onClick={() => {
                            const match = record.evidence.find((item) => item.sourceSegmentId === segment.id);
                            if (match) setActiveEvidence(match.id);
                          }} className={`w-full rounded-xl border p-4 text-left transition ${highlighted ? 'border-[#76a89e] bg-[#edf7f4] shadow-[0_0_0_2px_rgba(85,145,132,0.09)]' : 'border-transparent hover:border-[#dce6e3] hover:bg-[#f8faf9]'}`}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[9px] font-bold ${segment.role === 'RN' ? 'bg-[#dff0eb] text-[#2a6d61]' : 'bg-[#e8ecf3] text-[#526079]'}`}>{segment.role}</span><span className="text-[11px] font-semibold text-[#4f625f]">{segment.speaker}</span></div>
                              <span className="font-mono text-[10px] text-[#8b9997]">{formatTime(segment.start)}–{formatTime(segment.end)}</span>
                            </div>
                            <p className="text-[13px] leading-[1.65] text-[#30413f]">“{segment.text}”</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-[#d9e4e1] bg-white shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                    <div className="flex items-center justify-between border-b border-[#e1e8e6] px-5 py-4">
                      <div><h3 className="text-sm font-semibold">Structured care evidence</h3><p className="mt-0.5 text-[11px] text-[#7a8a87]">Observations mapped to the National QI set.</p></div>
                      <span className="rounded-lg bg-[#f0f4f3] px-2.5 py-1.5 text-[10px] font-semibold text-[#60736f]">{record.evidence.length} entries</span>
                    </div>
                    <div className="max-h-[580px] space-y-3 overflow-y-auto p-4 sm:p-5">
                      {record.evidence.map((item) => {
                        const selected = activeEvidence === item.id;
                        return (
                          <button type="button" key={item.id} onClick={() => setActiveEvidence(selected ? null : item.id)} className={`w-full overflow-hidden rounded-xl border text-left transition ${selected ? 'border-[#6e9f96] shadow-[0_0_0_2px_rgba(85,145,132,0.09)]' : 'border-[#dfe7e5] hover:border-[#afc5c0]'}`}>
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className={`mb-2 inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.09em] ${item.type === 'direct' ? 'bg-[#e5f4ef] text-[#236c5d]' : item.type === 'absence' ? 'bg-[#f4ead7] text-[#8a6429]' : 'bg-[#eee8f7] text-[#6f5196]'}`}>{typeLabel(item.type)}</span>
                                  <h4 className="text-[13px] font-semibold text-[#243936]">{item.observation}</h4>
                                </div>
                                <div className="shrink-0 text-right"><span className="block text-xs font-bold text-[#2d5f57]">{item.confidence}%</span><span className="text-[9px] uppercase tracking-wide text-[#8a9996]">confidence</span></div>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-[#667875]">{item.detail}</p>
                              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#e8eeec]"><div className="h-full rounded-full bg-[#4f9486]" style={{ width: `${item.confidence}%` }} /></div>
                              <div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0f6f4] px-2 py-1 text-[10px] font-semibold text-[#2f6d62]"><Activity className="size-3" />{item.indicator}</span><span className="text-[10px] font-medium text-[#60847e]">View source →</span></div>
                            </div>
                            <div className="border-t border-[#e2e9e7] bg-[#f8faf9] px-4 py-3"><p className="mb-1 text-[9px] font-bold uppercase tracking-[0.11em] text-[#859592]">Transcript source</p><p className="text-[11px] italic leading-relaxed text-[#536663]">“{item.quote}”</p></div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#dbe5e2] bg-[#eef4f2] px-4 py-3 text-xs leading-relaxed text-[#536a66]">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#397769]" />
                  <p><strong className="font-semibold text-[#294d47]">Decision support, not clinical advice.</strong> All AI-generated evidence requires RN review. This demo does not write to a clinical record.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
