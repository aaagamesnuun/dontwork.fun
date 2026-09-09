import {
  availableBets,
  money,
  status,
  totalCost,
  unlocked,
  usedSlots,
  type Run,
} from "./game/engine";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerGameTools(getState: () => Run) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifetime = new AbortController();
  const register = (tool: Tool) => {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifetime.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
  };
  register({
    name: "read_bebullish_position",
    title: "Read dontwork.fun position",
    description:
      "Read the current game balance, status and equipped gambles to explain the next spin. Does not spin or change the game.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).length
      )
        throw new Error("Expected an empty object.");
      const s = getState();
      return {
        balance: money(s.cash),
        status: status(s),
        auto: s.running,
        slots: `${usedSlots(s)}/${s.slots}`,
        cost: totalCost(s),
        jackpots: s.jackpots,
        rushRemaining: s.rushLeft,
        catalog: s.catalog,
        portfolio: s.portfolio,
        available: availableBets(s)
          .filter((b) => unlocked(s, b))
          .map((b) => ({ id: b.id, name: b.name, description: b.description })),
      };
    },
  });
  return () => lifetime.abort();
}
