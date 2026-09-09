(() => {
  "use strict";
  const protocol = "bebullish-transfer-v1";
  // Add the next published origin when preparing that release's bridge.
  const allowed = new Set(["https://dontwork.fun", "https://bebullish.fun", "https://bebullish-production.realnuun.chatgpt.site", "https://bebullish-v2-0.realnuun.chatgpt.site", "https://bebullish-v2-1.realnuun.chatgpt.site",
    "https://bebullish-v2-2.realnuun.chatgpt.site"]);
  const query = new URLSearchParams(location.search);
  const target = query.get("target"),
    nonce = query.get("nonce");
  const status = document.getElementById("status"),
    preview = document.getElementById("preview");
  const send = document.getElementById("send"),
    download = document.getElementById("download");
  let accepted = false,
    sent = false,
    save = null;
  const read = () => {
    const raw = localStorage.getItem("bebullish-save-v1");
    if (!raw)
      throw new Error(
        "このブラウザには旧版のセーブがありません。遊んでいたブラウザから開いてください。",
      );
    if (raw.length > 2_000_000)
      throw new Error(
        "セーブが大きすぎます。旧版の設定から書き出してください。",
      );
    const run = JSON.parse(raw);
    if (
      !run ||
      run.version !== 1 ||
      !Number.isFinite(run.cash) ||
      !Number.isInteger(run.spins)
    )
      throw new Error("セーブを読み取れませんでした。");
    return { raw, run };
  };
  const onMessage = (event) => {
    if (
      accepted ||
      sent ||
      !allowed.has(event.origin) ||
      event.origin !== target ||
      event.source !== window.opener ||
      event.data?.protocol !== protocol ||
      event.data?.nonce !== nonce ||
      event.data?.type !== "request"
    )
      return;
    accepted = true;
    try {
      const result = read();
      save = result.raw;
      preview.textContent =
        "$" +
        result.run.cash.toLocaleString("en-US", { maximumFractionDigits: 2 }) +
        " · " +
        result.run.spins.toLocaleString() +
        "スピン";
      preview.hidden = false;
      send.disabled = false;
      status.textContent =
        "このデータを新版へ送ります。下のボタンを押してください。";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "セーブにアクセスできませんでした。";
      window.opener.postMessage({ protocol, nonce, type: "error" }, target);
    }
  };
  window.addEventListener("message", onMessage);
  if (
    window.opener &&
    allowed.has(target) &&
    /^[a-f0-9-]{36}$/i.test(nonce ?? "")
  )
    window.opener.postMessage({ protocol, nonce, type: "ready" }, target);
  else
    status.textContent =
      "新版との接続がありません。ファイルを書き出して、新版の引き継ぎ画面で読み込めます。";
  send.addEventListener("click", () => {
    if (!accepted || sent || !save || !window.opener || !allowed.has(target))
      return;
    window.opener.postMessage({ protocol, nonce, type: "save", save }, target);
    sent = true;
    save = null;
    send.disabled = true;
    window.removeEventListener("message", onMessage);
    status.textContent = "送信しました。新版の画面で内容を確認してください。";
  });
  download.addEventListener("click", () => {
    try {
      const { raw } = read(),
        url = URL.createObjectURL(
          new Blob([raw], { type: "application/json" }),
        );
      const link = document.createElement("a");
      link.href = url;
      link.download = "bebullish-save.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent =
        "書き出しました。新版の引き継ぎ画面でこのファイルを選んでください。";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "書き出せませんでした。";
    }
  });
})();
