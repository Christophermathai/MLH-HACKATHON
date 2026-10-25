"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { scoreWords } from "@/lib/metrics";
import type { Evaluation, Manifest, RuntimeHealth, TranscriptionResult } from "@/lib/types";

type CurrentResult = TranscriptionResult & ReturnType<typeof scoreWords>;
type RunState = "idle" | "recording" | "ready" | "running" | "complete" | "error";

const STORAGE_KEY = "zoomout-whisper-evaluations-v1";

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatSeconds(value: number) {
  return `${value.toFixed(value < 10 ? 2 : 1)}s`;
}

function encodeWave(buffer: AudioBuffer) {
  const sampleCount = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + sampleCount * 2));
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const mono = channels.reduce((sum, channel) => sum + channel[sampleIndex], 0) / channels.length;
    const clamped = Math.max(-1, Math.min(1, mono));
    view.setInt16(44 + sampleIndex * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

export function ModelLab() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [result, setResult] = useState<CurrentResult | null>(null);
  const [meaning, setMeaning] = useState<Evaluation["meaningPreserved"]>("unsure");
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = useMemo(
    () => manifest?.samples.find((sample) => sample.id === selectedId) ?? null,
    [manifest, selectedId],
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/manifest", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/health", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([manifestData, healthData]: [Manifest, RuntimeHealth]) => {
      setManifest(manifestData);
      setSelectedId(manifestData.samples[0]?.id ?? "");
      setHealth(healthData);
    }).catch(() => setError("The evidence desk could not load its manifest or runtime status."));

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const evaluations = JSON.parse(saved) as Evaluation[];
        window.setTimeout(() => setHistory(evaluations), 0);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function resetRun(nextFile: File | null = null) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(nextFile);
    setAudioUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setResult(null);
    setRunState(nextFile ? "ready" : "idle");
    setError("");
    setMeaning("unsure");
    setRating(3);
    setNotes("");
  }

  function selectScenario(id: string) {
    setSelectedId(id);
    resetRun();
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio here. Upload a WAV, WebM, OGG, MP3, or M4A file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false } });
      const preferred = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"]
        .find((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        try {
          const encoded = new Blob(chunksRef.current, { type });
          const context = new AudioContext();
          const decoded = await context.decodeAudioData(await encoded.arrayBuffer());
          const file = new File([encodeWave(decoded)], `zoomout-${selectedId}.wav`, { type: "audio/wav" });
          await context.close();
          resetRun(file);
        } catch {
          resetRun();
          setError("The browser recording could not be converted to WAV. Try uploading a WAV file instead.");
        }
      };
      recorder.start(250);
      setRecordingSeconds(0);
      setRunState("recording");
      timerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds >= 59) recorderRef.current?.stop();
          return seconds + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone permission was not granted. You can still upload a prepared test clip.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is larger than the 5 MiB test limit.");
      return;
    }
    resetRun(file);
  }

  async function runTranscription() {
    if (!audioFile || !selected) return;
    setRunState("running");
    setError("");
    const form = new FormData();
    form.set("audio", audioFile);
    form.set("sampleId", selected.id);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Transcription failed.");
      const transcription = payload as TranscriptionResult;
      setResult({ ...transcription, ...scoreWords(selected.referenceText, transcription.text) });
      setRunState("complete");
    } catch (reason) {
      setRunState("error");
      setError(reason instanceof Error ? reason.message : "Transcription failed.");
    }
  }

  function saveEvaluation() {
    if (!result || !selected) return;
    const evaluation: Evaluation = {
      id: crypto.randomUUID(),
      sampleId: selected.id,
      scenario: selected.scenario,
      createdAt: new Date().toISOString(),
      mode: result.mode,
      transcript: result.text,
      referenceText: selected.referenceText,
      wordEdits: result.wordEdits,
      referenceWordCount: result.referenceWordCount,
      wordErrorRate: result.wordErrorRate,
      elapsedSeconds: result.elapsedSeconds,
      meaningPreserved: meaning,
      usabilityRating: rating,
      notes: notes.trim(),
    };
    const next = [evaluation, ...history].slice(0, 25);
    setHistory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNotes("");
  }

  function exportEvidence() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), model: manifest?.model, evaluations: history }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zoomout-whisper-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const healthClass = health?.mode ?? "blocked";

  return (
    <main className="lab-shell">
      <div className="paper-noise" aria-hidden="true" />
      <header className="masthead reveal reveal-1">
        <div className="identity">
          <span className="case-mark" aria-hidden="true">ZO</span>
          <div>
            <p className="eyebrow">Case file 001 · Speech evidence</p>
            <h1>Whisper Evidence Desk</h1>
          </div>
        </div>
        <div className={`runtime-stamp ${healthClass}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{health?.mode ?? "checking"}</span>
          <small>{health?.model ?? manifest?.model ?? "elevenlabs/scribe_v1"}</small>
        </div>
      </header>

      <section className="intro-grid reveal reveal-2">
        <div>
          <p className="kicker">Malayalam model usability lab</p>
          <h2>Can the model preserve the point, not just the words?</h2>
        </div>
        <div className="intro-note">
          <span>Purpose</span>
          <p>Run the same five cases, measure word edits and latency, then add the human judgment that numbers miss.</p>
        </div>
      </section>

      {health && <aside className={`runtime-note ${health.mode}`} role="status"><strong>Runtime:</strong> {health.message}</aside>}
      {error && <aside className="error-note" role="alert"><strong>Desk note:</strong> {error}</aside>}

      <div className="workflow">
        <nav className="case-list reveal reveal-3" aria-label="Speech scenarios">
          <p className="section-label">01 / Choose evidence</p>
          {manifest?.samples.map((sample, index) => (
            <button
              className={`case-button ${sample.id === selectedId ? "active" : ""}`}
              key={sample.id}
              onClick={() => selectScenario(sample.id)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{sample.scenario}</strong><small>Target · {sample.expectedDurationSeconds}s</small></span>
            </button>
          ))}
        </nav>

        <section className="evidence-panel reveal reveal-4">
          <div className="panel-heading">
            <p className="section-label">02 / Capture testimony</p>
            <span className="evidence-tag">{selected?.id ?? "loading"}</span>
          </div>
          <div className="script-card" lang="ml">
            <span>Read this naturally</span>
            <blockquote>{selected?.referenceText ?? "Loading Malayalam reference…"}</blockquote>
            <p>{selected?.provenance}</p>
          </div>

          <div className={`recorder ${runState === "recording" ? "is-recording" : ""}`}>
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -70}ms` }} />)}
            </div>
            <div className="record-copy">
              <strong>{runState === "recording" ? `Recording · ${recordingSeconds}s` : audioFile ? audioFile.name : "No testimony attached"}</strong>
              <span>{audioFile ? `${(audioFile.size / 1024).toFixed(0)} KiB · ready for the desk` : "Record up to 60 seconds or upload an existing clip."}</span>
            </div>
            <div className="record-actions">
              {runState === "recording" ? (
                <button className="primary stop" onClick={stopRecording} type="button">Stop recording</button>
              ) : (
                <button className="primary" onClick={startRecording} type="button">Use microphone</button>
              )}
              <label className="file-button">
                Upload audio
                <input accept=".wav,.webm,.ogg,.mp3,.m4a,.aac,audio/*" onChange={handleUpload} type="file" />
              </label>
            </div>
          </div>

          {audioUrl && <audio className="audio-preview" controls src={audioUrl}>Your browser cannot preview this audio.</audio>}

          <button className="run-button" disabled={!audioFile || runState === "running" || health?.mode === "blocked"} onClick={runTranscription} type="button">
            <span>{runState === "running" ? "Examining the evidence…" : "Run Whisper pass"}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </section>

        <section className="verdict-panel reveal reveal-5">
          <div className="panel-heading">
            <p className="section-label">03 / Judge usability</p>
            <span className={`mode-chip ${result?.mode ?? "pending"}`}>{result?.mode ?? "awaiting pass"}</span>
          </div>
          {!result ? (
            <div className="empty-result">
              <span aria-hidden="true">“</span>
              <p>The transcript and evidence measures will appear here after a pass.</p>
            </div>
          ) : (
            <>
              {result.warning && <div className="simulation-warning">{result.warning}</div>}
              <div className="metric-row">
                <div><span>WER</span><strong>{formatPercent(result.wordErrorRate)}</strong><small>{result.wordEdits} word edits</small></div>
                <div><span>Latency</span><strong>{formatSeconds(result.elapsedSeconds)}</strong><small>inference only</small></div>
                <div><span>Words</span><strong>{result.referenceWordCount}</strong><small>reference count</small></div>
              </div>
              <div className="transcript-card" lang="ml">
                <span>Model transcript</span>
                <p>{result.text || "No speech recognized."}</p>
              </div>
              <fieldset className="meaning-field">
                <legend>Was the meaning preserved?</legend>
                {(["yes", "no", "unsure"] as const).map((option) => (
                  <label key={option}><input checked={meaning === option} name="meaning" onChange={() => setMeaning(option)} type="radio" />{option}</label>
                ))}
              </fieldset>
              <label className="rating-field">
                <span>Usability rating <strong>{rating}/5</strong></span>
                <input max="5" min="1" onChange={(event) => setRating(Number(event.target.value))} type="range" value={rating} />
              </label>
              <label className="notes-field">
                <span>Reviewer notes</span>
                <textarea onChange={(event) => setNotes(event.target.value)} placeholder="Code switching, changed meaning, odd spelling, latency…" value={notes} />
              </label>
              <button className="save-button" onClick={saveEvaluation} type="button">Add to evidence log</button>
            </>
          )}
        </section>
      </div>

      <section className="evidence-log reveal reveal-5">
        <div className="log-heading">
          <div><p className="section-label">Evidence log</p><h2>{history.length} saved passes</h2></div>
          <button disabled={!history.length} onClick={exportEvidence} type="button">Export JSON ↓</button>
        </div>
        {history.length ? (
          <div className="log-table" role="table" aria-label="Saved evaluations">
            <div className="log-row log-header" role="row"><span>Scenario</span><span>Mode</span><span>WER</span><span>Meaning</span><span>Rating</span></div>
            {history.map((item) => (
              <div className="log-row" key={item.id} role="row">
                <span><strong>{item.scenario}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span>
                <span data-label="Mode">{item.mode}</span>
                <span data-label="WER">{formatPercent(item.wordErrorRate)}</span>
                <span data-label="Meaning">{item.meaningPreserved}</span>
                <span data-label="Rating">{item.usabilityRating}/5</span>
              </div>
            ))}
          </div>
        ) : <p className="empty-log">No evidence saved yet. Complete a pass and add the human judgment.</p>}
      </section>

      <footer><span>ZoomOut · Big feelings. Small problems. Better evidence.</span><span>Audio is deleted by the server after each request.</span></footer>
    </main>
  );
}
