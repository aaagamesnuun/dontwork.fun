import type { Settings } from "./game/engine";
export const MUSIC_TRACKS = [
  {
    "id": "bit-quest",
    "title": "Bit Quest",
    "source": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500073",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "pixelland",
    "title": "Pixelland",
    "source": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500076",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "cipher",
    "title": "Cipher",
    "source": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "envision",
    "title": "Envision",
    "source": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900000",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  }
] as const;
export const recordedTrack=(pack:string)=>MUSIC_TRACKS.find(t=>t.id===pack);
let player:HTMLAudioElement|null=null,key="",attempt=false,retryAt=0;
export function stopRecordedMusic(){player?.pause();}
export function playRecordedMusic(settings:Settings,active:boolean,rush=false){
  const track=recordedTrack(settings.musicPack);
  const wants=rush&&settings.jackpotMusic!=="follow"?settings.jackpotMusic==="on":settings.music;
  if(!track||!active||!wants||settings.musicVolume<=0){stopRecordedMusic();return;}
  if(typeof Audio==="undefined")return;
  if(key!==track.id||!player){player?.pause();player=new Audio(`/music/${track.id}.m4a`);player.loop=true;player.preload="none";key=track.id;attempt=false;retryAt=0;}
  player.volume=Math.min(1,settings.musicVolume*(rush?.85:1));
  if(player.paused&&!attempt&&Date.now()>=retryAt){const current=player;attempt=true;void current.play().catch(()=>{retryAt=Date.now()+2000}).finally(()=>{if(current===player)attempt=false});}
}
