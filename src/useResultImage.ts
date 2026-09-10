import {useEffect,useRef,useState} from 'react';
import {useLanguage} from './i18n';
import {resultImage} from './resultShare';
import {rankedRecord,type ResultRanking} from './resultRanking';
import type {Run} from './game/engine';
// A PNG and its displayed URL belong to the same name/rank snapshot. Never
// offer an older PNG while the newly fetched rank is already in the post text.
export function useResultImage(s:Run,name:string,ranking:ResultRanking|null,enabled:boolean) {
  const language=useLanguage();
  const key=JSON.stringify([rankedRecord(s)?.id??s.id,name,ranking,language]);
  const liveUrl=useRef('');
  const [image,setImage]=useState<{key:string;blob:Blob|null;url:string;failed:boolean}|null>(null);
  useEffect(()=>{
    if(!enabled||!name)return;
    let live=true,url='';
    void resultImage(s,name,ranking).then(blob=>{
      if(!live)return;url=URL.createObjectURL(blob);liveUrl.current=url;setImage({key,blob,url,failed:false});
    }).catch(()=>{if(live)setImage({key,blob:null,url:'',failed:true});});
    return()=>{live=false;if(url){if(liveUrl.current===url)liveUrl.current='';URL.revokeObjectURL(url);}};
  },[key,enabled]);
  return enabled&&!!name&&image?.key===key&&image.url===liveUrl.current?image:{blob:null,url:'',failed:false};
}
