import { useSyncExternalStore } from "react";
import english from "./locales/en.json";
export type Language="ja"|"en";
const KEY="dontwork-language";
export function defaultLanguage():Language {try {const chosen=localStorage.getItem(KEY);if(chosen==="en"||chosen==="ja")return chosen;}catch{}return typeof document!=="undefined"&&typeof navigator!=="undefined"&&(navigator.languages?.[0]??navigator.language??"").toLowerCase().startsWith("en")?"en":"ja";}
let current:Language=defaultLanguage();const listeners=new Set<()=>void>();
export const language=()=>current;
export function setLanguage(value:Language){current=value;try{localStorage.setItem(KEY,value)}catch{}if(typeof document!=="undefined")document.documentElement.lang=value;listeners.forEach(fn=>fn());}
export const useLanguage=()=>useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},language,language);
export function t(key:string,...values:unknown[]):string {const template=current==="en"?(english as Record<string,string>)[key]??key:key;return template.replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??""));}
export function textValue<T>(value:T):T {return (typeof value==="string"?t(value):value) as T;}
