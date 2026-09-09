import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const target = "https://bebullish-v2-0.realnuun.chatgpt.site",
  nonce = "11111111-1111-4111-8111-111111111111";
function bridge(target = "https://bebullish-v2-0.realnuun.chatgpt.site") {
  const handlers = {},
    nodes = {};
  const document = {
    getElementById: (id) =>
      (nodes[id] ??= {
        hidden: true,
        disabled: true,
        textContent: "",
        addEventListener: (name, fn) => {
          handlers[id + ":" + name] = fn;
        },
      }),
  };
  const opener = { postMessage: vi.fn() };
  const window = {
    opener,
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
    removeEventListener: vi.fn(),
  };
  const localStorage = {
    getItem: vi.fn(() => JSON.stringify({ version: 1, cash: 123, spins: 12 })),
  };
  runInNewContext(
    readFileSync(new URL("../public/transfer.js", import.meta.url), "utf8"),
    {
      window,
      document,
      localStorage,
      location: {
        search: "?target=" + encodeURIComponent(target) + "&nonce=" + nonce,
      },
      URLSearchParams,
      Set,
    },
  );
  const valid = {
    origin: target,
    source: opener,
    data: { protocol: "bebullish-transfer-v1", nonce, type: "request" },
  };
  return { handlers, nodes, window, opener, localStorage, valid };
}
describe("old-origin transfer bridge", () => {
  it("reads only the requested game save after origin/source/nonce verification and waits for the send action", () => {
    const b = bridge();
    expect(b.localStorage.getItem).not.toHaveBeenCalled();
    expect(b.opener.postMessage).toHaveBeenCalledWith(
      { protocol: "bebullish-transfer-v1", nonce, type: "ready" },
      target,
    );
    for (const event of [
      { ...b.valid, origin: "https://evil.example" },
      { ...b.valid, source: {} },
      { ...b.valid, data: { ...b.valid.data, nonce: "other" } },
    ])
      b.handlers.message(event);
    expect(b.localStorage.getItem).not.toHaveBeenCalled();
    b.handlers.message(b.valid);
    expect(b.localStorage.getItem.mock.calls).toEqual([["bebullish-save-v1"]]);
    expect(b.opener.postMessage).toHaveBeenCalledTimes(1);
    expect(b.nodes.send.disabled).toBe(false);
    b.handlers["send:click"]();
    expect(b.opener.postMessage).toHaveBeenCalledTimes(2);
    const [message, origin] = b.opener.postMessage.mock.calls[1];
    expect(origin).toBe(target);
    expect(JSON.parse(message.save).cash).toBe(123);
    b.handlers["send:click"]();
    expect(b.opener.postMessage).toHaveBeenCalledTimes(2);
  });
  it("does not send missing or corrupt storage as a new game", () => {
    for (const raw of [null, "bad", "null"]) {
      const b = bridge();
      b.localStorage.getItem.mockReturnValue(raw);
      b.handlers.message(b.valid);
      b.handlers["send:click"]();
      expect(b.nodes.send.disabled).toBe(true);
      expect(b.opener.postMessage).toHaveBeenCalledTimes(2);
      expect(b.opener.postMessage.mock.calls[1][0].type).toBe("error");
    }
  });
});


it('allows the production opener only after the same explicit save-send action',()=>{
 const target='https://bebullish.fun',b=bridge(target);
 b.handlers.message(b.valid);
 expect(b.opener.postMessage).toHaveBeenCalledTimes(1);
 b.handlers['send:click']();
 expect(b.opener.postMessage.mock.calls[1][1]).toBe(target);
 expect(JSON.parse(b.opener.postMessage.mock.calls[1][0].save).cash).toBe(123);
});
