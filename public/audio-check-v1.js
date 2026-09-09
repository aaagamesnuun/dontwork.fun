const $ = (id) => document.getElementById(id);
const aButton = $("play-a"), bButton = $("play-b"), stopButton = $("stop");
const file = new Audio("/audio-check-v1.wav");
file.preload = "auto";
let context = null, source = null, frame = 0, token = 0, deadline = 0;
let active = false, finishedA = false, usedWebAudio = false;

function release() {
  clearTimeout(deadline);
  cancelAnimationFrame(frame);
  file.pause();
  if (source) {
    source.onended = null;
    try { source.stop(); } catch { /* Already ended. */ }
    source.disconnect();
    source = null;
  }
  if (context) {
    const old = context;
    context = null;
    void old.close().catch(() => {});
  }
}

function buttons() {
  // Once B has opened Web Audio, reload before trying A again so the
  // supposedly native-only baseline cannot inherit B's audio context.
  aButton.disabled = active || usedWebAudio;
  bButton.disabled = active || !finishedA || usedWebAudio;
  stopButton.hidden = !active;
  $("restart").hidden = !usedWebAudio || active;
}

function showTime(time) {
  const elapsed = Math.max(0, Math.min(7, time));
  $("clock").textContent = `${elapsed.toFixed(1)} / 7.0 秒`;
  $("progress").value = elapsed;
}

function finish(mode, currentToken) {
  if (currentToken !== token || !active) return;
  active = false;
  if (mode === "A") finishedA = true;
  release();
  showTime(7);
  $("label").textContent = `${mode} · 再生終了`;
  $("status").textContent = mode === "A"
    ? "続いて「Bを再生」を押してください。"
    : "画面収録を止めて、保存された動画をこのチャットへ送ってください。";
  buttons();
}

function fail(message, currentToken) {
  if (currentToken !== token) return;
  active = false;
  release();
  $("label").textContent = "再生できませんでした";
  $("status").textContent = message;
  buttons();
}

function updateClock(readTime, currentToken) {
  if (currentToken !== token || !active) return;
  showTime(readTime());
  frame = requestAnimationFrame(() => updateClock(readTime, currentToken));
}

async function start(mode) {
  if (active || usedWebAudio || (mode === "B" && !finishedA)) return;
  const currentToken = ++token;
  active = true;
  showTime(0);
  $("label").textContent = `${mode} · ${mode === "A" ? "音声ファイル" : "ゲームと同じ方式"}`;
  $("status").textContent = "準備中…";
  buttons();
  deadline = setTimeout(() => fail("再生が進みません。通信を確認して、もう一度お試しください。", currentToken), 18000);
  try {
    if (mode === "A") {
      file.currentTime = 0;
      file.onended = () => finish(mode, currentToken);
      file.onerror = () => fail("音声ファイルを読み込めません。通信を確認してAをもう一度押してください。", currentToken);
      await file.play();
      if (currentToken !== token || !active) return;
      $("status").textContent = "再生中 · そのまま7秒お待ちください。";
      updateClock(() => file.currentTime, currentToken);
    } else {
      usedWebAudio = true;
      const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio unavailable");
      const ctx = new AudioCtor();
      context = ctx;
      // Invoke resume directly in the tap before waiting for network/decoding.
      const resumed = ctx.resume();
      const loaded = fetch("/audio-check-v1.wav").then(response => {
        if (!response.ok) throw new Error("Audio load failed");
        return response.arrayBuffer();
      }).then(bytes => ctx.decodeAudioData(bytes));
      const [buffer] = await Promise.all([loaded, resumed]);
      if (currentToken !== token || !active || context !== ctx) return;
      if (ctx.state !== "running") throw new Error("Audio suspended");
      const node = ctx.createBufferSource();
      source = node;
      node.buffer = buffer;
      node.connect(ctx.destination);
      node.onended = () => finish(mode, currentToken);
      const at = ctx.currentTime + 0.05;
      node.start(at);
      $("details").textContent = `CHECK 1 · B ${ctx.sampleRate} Hz`;
      $("status").textContent = "再生中 · そのまま7秒お待ちください。";
      updateClock(() => ctx.currentTime - at, currentToken);
    }
  } catch {
    fail(mode === "A"
      ? "音声を再生できません。通信を確認してAをもう一度押してください。"
      : "Bを再生できません。「最初からやり直す」を押してください。", currentToken);
  }
}

function interrupt() {
  if (!active) return;
  ++token;
  active = false;
  release();
  $("label").textContent = "停止しました";
  $("status").textContent = usedWebAudio
    ? "「最初からやり直す」を押してください。"
    : "このまま録画を続け、Aをもう一度押してください。";
  buttons();
}

aButton.addEventListener("click", () => start("A"));
bButton.addEventListener("click", () => start("B"));
stopButton.addEventListener("click", interrupt);
$("restart").addEventListener("click", () => location.reload());
document.addEventListener("visibilitychange", () => { if (document.hidden) interrupt(); });
window.addEventListener("pagehide", interrupt);
