import { afterEach, expect, it, vi } from "vitest";
import type { MouseEvent } from "react";
import { useWorkBurst } from "./WorkBurst";

vi.mock("react", () => ({ useRef: (current: unknown) => ({ current }), useEffect: () => {} }));
afterEach(() => vi.unstubAllGlobals());

it("shows exactly one $1 coin per WORK click at every intensity", () => {
  for (const intensity of [.25, 1, 2]) {
    const images: {src:string;className:string;style:Record<string,string>;animate:ReturnType<typeof vi.fn>}[]=[];
    vi.stubGlobal("document", {createElement: () => {
      const image={src:"",alt:"",className:"",style:{},animate:vi.fn(()=>({onfinish:null}))};
      images.push(image);return image;
    }});
    const effect=useWorkBurst(false,intensity);
    const host={children:[],append:vi.fn()};
    effect.layer.current=host as unknown as HTMLDivElement;
    effect.burst({currentTarget:{getBoundingClientRect:()=>({left:0,top:500,width:100}),animate:vi.fn()}} as unknown as MouseEvent<HTMLButtonElement>);
    expect(images).toHaveLength(1);expect(host.append).toHaveBeenCalledTimes(1);
    expect(images[0].src).toBe("/banknotes/coin-1.webp");
    expect(images[0].className).toContain("work-coin");
  }
});
