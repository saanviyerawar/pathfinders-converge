'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  Check,
  ChevronDown,
  CircleUserRound,
  FileAudio,
  LayoutDashboard,
  MapPin,
  Mic,
  MoreHorizontal,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
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

type FlowState = 'idle' | 'recording' | 'transcribing' | 'mapping' | 'done';

const navItems = [
  { label: 'Shift overview', icon: LayoutDashboard, active: true },
  { label: 'Residents', icon: UsersRound, active: false },
  { label: 'Quality indicators', icon: Activity, active: false },
];

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatSegmentTime(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function typeLabel(type: Evidence['type']) {
  if (type === 'direct') return 'Direct observation';
  if (type === 'absence') return 'Absence signal';
  return 'Inferred risk';
}

export default function Home() {
  const [record, setRecord] = useState<CareRecord | null>(null);
  const [flow, setFlow] = useState<FlowState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRecording = flow === 'recording';
  const isProcessing = flow === 'transcribing' || flow === 'mapping';
  const indicators = record ? [...new Set(record.evidence.map((item) => item.indicator))] : [];
  const activeSource = record?.evidence.find((item) => item.id === activeEvidence)?.sourceSegmentId;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function processRecording(blob: Blob, mimeType: string) {
    setFlow('transcribing');
    setError(null);

    try {
      const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `care-note-${Date.now()}.${extension}`, { type: mimeType });
      const body = new FormData();
      body.append('audio', file);

      const request = fetch('/api/process', { method: 'POST', body });
      await delay(800);
      setFlow('mapping');
      const response = await request;
      const payload = (await response.json()) as { error?: string; record?: CareRecord };
      if (!response.ok) throw new Error(payload.error || 'The recording could not be processed.');
      if (!payload.record) throw new Error('The processed care record was empty.');

      await delay(450);
      setRecord(payload.record);
      setActiveEvidence(null);
      setFlow('done');
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : 'The recording could not be processed.');
      setFlow('idle');
    }
  }

  async function startRecording() {
    setError(null);
    setRecord(null);
    setActiveEvidence(null);
    setElapsed(0);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser. Please use a current version of Chrome, Edge or Safari.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('The microphone recording was interrupted. Please try again.');
        setFlow('idle');
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const recordingType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recordingType });
        chunksRef.current = [];
        void processRecording(blob, recordingType);
      };

      recorder.start(250);
      setFlow('recording');
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (permissionError) {
      console.error(permissionError);
      setError('Microphone access is needed to capture the care conversation. Please allow access and try again.');
      setFlow('idle');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  function reset() {
    setRecord(null);
    setFlow('idle');
    setError(null);
    setElapsed(0);
    setActiveEvidence(null);
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
                <Icon className="size-[18px]" />{label}
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4">
            <div className="rounded-xl border border-white/10 bg-white/6 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#d8f26a]"><ShieldCheck className="size-4" />Evidence-first</div>
              <p className="text-xs leading-relaxed text-white/55">Every care claim remains linked to its exact transcript source.</p>
            </div>
            <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left">
              <span className="grid size-9 place-items-center rounded-full bg-[#d8f26a] text-xs font-bold text-[#163b38]">JB</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">James Blissett</span><span className="block truncate text-[11px] text-white/44">Demo facility</span></span>
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
                <button type="button" className="flex items-center gap-1.5 text-base font-semibold tracking-tight">Morning shift · 20 September <ChevronDown className="size-4 text-[#6f817e]" /></button>
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
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#46736f]"><span className="size-2 rounded-full bg-[#4a9b83]" />Ready to capture a care conversation</div>
                <h1 className="font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-[30px]">Speak naturally. Keep the evidence.</h1>
                <p className="mt-1 max-w-2xl text-sm text-[#667875]">Record a bounded briefing or handover, then review every mapped observation against the words that produced it.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#667875]"><ShieldCheck className="size-4" />Nothing is saved to a clinical record</div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="space-y-5">
                <section className="rounded-2xl border border-[#d9e4e1] bg-white p-5 shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div><h2 className="text-base font-semibold tracking-tight">Record care note</h2><p className="mt-1 text-xs leading-relaxed text-[#748481]">One press to start. One press to finish.</p></div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e6f3ef] text-[#26715f]"><Mic className="size-[18px]" /></span>
                  </div>

                  <div className={`relative flex min-h-[268px] flex-col items-center justify-center overflow-hidden rounded-2xl border px-5 py-7 text-center transition ${isRecording ? 'border-[#d46b58] bg-[#fff7f4]' : isProcessing ? 'border-[#8bb8ae] bg-[#f0f7f5]' : 'border-[#dbe5e2] bg-[#f8faf9]'}`}>
                    {isRecording && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-45" aria-hidden="true">
                        {[1, 2, 3].map((ring) => <span key={ring} className="absolute size-28 animate-ping rounded-full border border-[#df8a79]" style={{ animationDelay: `${ring * 240}ms`, animationDuration: '1.8s' }} />)}
                      </div>
                    )}

                    {isProcessing ? (
                      <>
                        <span className="relative mb-4 grid size-20 place-items-center rounded-full bg-[#0c3a38] text-[#d8f26a] shadow-lg"><AudioLines className="size-8 animate-pulse" /></span>
                        <p className="text-base font-semibold">{flow === 'transcribing' ? 'Transcribing conversation' : 'Mapping care evidence'}</p>
                        <p className="mt-1 text-xs text-[#748481]">{flow === 'transcribing' ? 'Separating speakers and converting speech to text…' : 'Linking observations to quality indicators…'}</p>
                        <div className="mt-5 flex gap-1.5" aria-hidden="true">{[0, 1, 2, 3, 4].map((bar) => <span key={bar} className="w-1 animate-pulse rounded-full bg-[#4d9184]" style={{ height: `${12 + (bar % 3) * 8}px`, animationDelay: `${bar * 120}ms` }} />)}</div>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`relative grid size-24 place-items-center rounded-full text-white shadow-[0_14px_34px_rgba(20,55,51,0.22)] transition hover:scale-[1.03] active:scale-[0.98] ${isRecording ? 'bg-[#c95d4a]' : 'bg-[#0c3a38]'}`} aria-label={isRecording ? 'Stop recording' : 'Start recording'}>
                          {isRecording ? <Square className="size-8 fill-current" /> : <Mic className="size-9" />}
                        </button>
                        <p className={`mt-5 font-mono text-2xl font-semibold tracking-tight ${isRecording ? 'text-[#a34231]' : 'text-[#203b37]'}`}>{formatClock(elapsed)}</p>
                        <p className="mt-1 text-sm font-semibold">{isRecording ? 'Recording in progress' : record ? 'Ready for another note' : 'Tap to begin recording'}</p>
                        <p className="mt-1 text-xs text-[#7a8986]">{isRecording ? 'Press stop when the conversation is complete.' : 'Your browser will ask for microphone access.'}</p>
                      </>
                    )}
                  </div>

                  {error && <div role="alert" className="mt-3 rounded-lg border border-[#efc6bd] bg-[#fff5f2] px-3 py-2.5 text-xs leading-relaxed text-[#9a4634]">{error}</div>}

                  {record && !isProcessing && (
                    <Button variant="outline" className="mt-3 w-full" onClick={reset}><RotateCcw />Clear and record again</Button>
                  )}
                </section>

                <section className="rounded-2xl border border-[#d9e4e1] bg-[#113f3c] p-5 text-white shadow-[0_12px_30px_rgba(20,55,51,0.08)]">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-[#d8f26a]" />Processing trace</div>
                  <div className="mt-5 space-y-0">
                    {[
                      { label: 'Capture', detail: isRecording ? 'Recording securely' : elapsed > 0 ? 'Recording complete' : 'Waiting to begin', complete: elapsed > 0 && !isRecording },
                      { label: 'Transcribe', detail: flow === 'transcribing' ? 'Separating speakers' : record || flow === 'mapping' ? 'Speakers separated' : 'Waiting for recording', complete: Boolean(record) || flow === 'mapping' },
                      { label: 'Map', detail: record ? `${record.evidence.length} evidence entries found` : flow === 'mapping' ? 'Classifying observations' : 'Waiting for transcript', complete: Boolean(record) },
                    ].map((stage, index) => (
                      <div className="grid grid-cols-[24px_1fr] gap-3" key={stage.label}>
                        <div className="flex flex-col items-center"><span className={`grid size-6 place-items-center rounded-full ${stage.complete ? 'bg-[#d8f26a] text-[#173f3c]' : 'border border-white/22 bg-white/8 text-white/40'}`}>{stage.complete ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}</span>{index < 2 && <span className="h-8 w-px bg-white/18" />}</div>
                        <div className="pb-4"><p className="text-xs font-semibold">{stage.label}</p><p className="mt-0.5 text-[11px] text-white/50">{stage.detail}</p></div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-5">
                {!record ? (
                  <section className="flex min-h-[600px] flex-col items-center justify-center rounded-2xl border border-[#d9e4e1] bg-white px-6 py-16 text-center shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                    <span className="grid size-16 place-items-center rounded-2xl bg-[#eaf4f1] text-[#327467]"><AudioLines className="size-7" /></span>
                    <h2 className="mt-5 text-lg font-semibold tracking-tight">Care evidence will appear here</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#71817e]">Once the conversation ends, the transcript, observations and quality-indicator mappings will be assembled into a source-linked record.</p>
                    <div className="mt-7 grid w-full max-w-lg gap-3 sm:grid-cols-3">
                      {['Speaker-separated transcript', 'Structured observations', 'Traceable QI mapping'].map((item, index) => <div key={item} className="rounded-xl border border-[#e0e8e6] bg-[#f8faf9] p-3"><span className="mx-auto mb-2 grid size-6 place-items-center rounded-full bg-[#dcece7] text-[10px] font-bold text-[#346f64]">{index + 1}</span><p className="text-[11px] font-semibold text-[#506763]">{item}</p></div>)}
                    </div>
                  </section>
                ) : (
                  <>
                    <section className="rounded-2xl border border-[#d9e4e1] bg-white shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                      <div className="flex flex-col gap-4 border-b border-[#e1e8e6] p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-full bg-[#e7f0ee] text-sm font-bold text-[#2d655d]">{record.resident.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight">{record.resident}</h2><Badge variant="secondary" className="bg-[#eef3f2] text-[#506b67]">Needs RN review</Badge></div><p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#73837f]"><MapPin className="size-3.5" />{record.room}</p></div>
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
                        <div className="flex items-center justify-between border-b border-[#e1e8e6] px-5 py-4"><div><h3 className="text-sm font-semibold">Source transcript</h3><p className="mt-0.5 text-[11px] text-[#7a8a87]">Select evidence to locate its source.</p></div><Badge variant="outline" className="border-[#d9e4e1] text-[#5f7470]"><FileAudio /> English (AU)</Badge></div>
                        <div className="max-h-[580px] space-y-2 overflow-y-auto p-4 sm:p-5">
                          {record.segments.map((segment) => {
                            const highlighted = activeSource === segment.id;
                            return <button type="button" key={segment.id} onClick={() => { const match = record.evidence.find((item) => item.sourceSegmentId === segment.id); if (match) setActiveEvidence(match.id); }} className={`w-full rounded-xl border p-4 text-left transition ${highlighted ? 'border-[#76a89e] bg-[#edf7f4] shadow-[0_0_0_2px_rgba(85,145,132,0.09)]' : 'border-transparent hover:border-[#dce6e3] hover:bg-[#f8faf9]'}`}>
                              <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[9px] font-bold ${segment.role === 'RN' ? 'bg-[#dff0eb] text-[#2a6d61]' : 'bg-[#e8ecf3] text-[#526079]'}`}>{segment.role}</span><span className="text-[11px] font-semibold text-[#4f625f]">{segment.speaker}</span></div><span className="font-mono text-[10px] text-[#8b9997]">{formatSegmentTime(segment.start)}–{formatSegmentTime(segment.end)}</span></div>
                              <p className="text-[13px] leading-[1.65] text-[#30413f]">“{segment.text}”</p>
                            </button>;
                          })}
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-2xl border border-[#d9e4e1] bg-white shadow-[0_12px_30px_rgba(20,55,51,0.045)]">
                        <div className="flex items-center justify-between border-b border-[#e1e8e6] px-5 py-4"><div><h3 className="text-sm font-semibold">Structured care evidence</h3><p className="mt-0.5 text-[11px] text-[#7a8a87]">Observations mapped to the National QI set.</p></div><span className="rounded-lg bg-[#f0f4f3] px-2.5 py-1.5 text-[10px] font-semibold text-[#60736f]">{record.evidence.length} entries</span></div>
                        <div className="max-h-[580px] space-y-3 overflow-y-auto p-4 sm:p-5">
                          {record.evidence.map((item) => {
                            const selected = activeEvidence === item.id;
                            return <button type="button" key={item.id} aria-label={`View transcript source for ${item.observation}`} onClick={() => setActiveEvidence(selected ? null : item.id)} className={`w-full overflow-hidden rounded-xl border text-left transition ${selected ? 'border-[#6e9f96] shadow-[0_0_0_2px_rgba(85,145,132,0.09)]' : 'border-[#dfe7e5] hover:border-[#afc5c0]'}`}>
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-3"><div><span className={`mb-2 inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.09em] ${item.type === 'direct' ? 'bg-[#e5f4ef] text-[#236c5d]' : item.type === 'absence' ? 'bg-[#f4ead7] text-[#8a6429]' : 'bg-[#eee8f7] text-[#6f5196]'}`}>{typeLabel(item.type)}</span><h4 className="text-[13px] font-semibold text-[#243936]">{item.observation}</h4></div><div className="shrink-0 text-right"><span className="block text-xs font-bold text-[#2d5f57]">{item.confidence}%</span><span className="text-[9px] uppercase tracking-wide text-[#8a9996]">confidence</span></div></div>
                                <p className="mt-2 text-xs leading-relaxed text-[#667875]">{item.detail}</p>
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#e8eeec]"><div className="h-full rounded-full bg-[#4f9486]" style={{ width: `${item.confidence}%` }} /></div>
                                <div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0f6f4] px-2 py-1 text-[10px] font-semibold text-[#2f6d62]"><Activity className="size-3" />{item.indicator}</span><span className="text-[10px] font-medium text-[#60847e]">View source →</span></div>
                              </div>
                              <div className="border-t border-[#e2e9e7] bg-[#f8faf9] px-4 py-3"><p className="mb-1 text-[9px] font-bold uppercase tracking-[0.11em] text-[#859592]">Transcript source</p><p className="text-[11px] italic leading-relaxed text-[#536663]">“{item.quote}”</p></div>
                            </button>;
                          })}
                        </div>
                      </section>
                    </div>
                  </>
                )}

                <div className="flex items-start gap-3 rounded-xl border border-[#dbe5e2] bg-[#eef4f2] px-4 py-3 text-xs leading-relaxed text-[#536a66]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#397769]" /><p><strong className="font-semibold text-[#294d47]">Decision support, not clinical advice.</strong> All generated evidence requires RN review. This demo does not write to a clinical record.</p></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
