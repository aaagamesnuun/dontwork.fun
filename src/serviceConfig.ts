// Official deployments retain their shared ranking service. Forks never
// send data there unless they are actually running on an official origin.
const officialHosts = new Set(["dontwork.fun", "bebullish.fun", "dontwork-fun.ronefire.workers.dev"]);
export const officialDeployment = () => typeof location !== "undefined" && location.protocol === "https:" && officialHosts.has(location.hostname);
export const servicesEnabled = () => import.meta.env.MODE === "test" || officialDeployment() || import.meta.env.VITE_ENABLE_SERVICES === "true";
export const defaultTelemetry = () => import.meta.env.MODE === "test" || officialDeployment() || import.meta.env.VITE_ENABLE_TELEMETRY === "true";
export const sharedServiceOrigin = () => officialDeployment() || import.meta.env.MODE === "test" ? "https://bebullish-v1-10-0.realnuun.chatgpt.site" : "";
