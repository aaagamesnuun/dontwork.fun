import { useEffect, useRef, type MouseEvent } from 'react';
import { cashImage } from './cashSprites';
export function useWorkBurst(reduced:boolean,intensity=1) {
 const layer=useRef<HTMLDivElement>(null),serial=useRef(0);
 const src=cashImage(100);
 useEffect(()=>{const note=new Image();note.src=src},[src]);
 useEffect(()=>()=>layer.current?.replaceChildren(),[]);
 const burst=(event:MouseEvent<HTMLButtonElement>)=>{
  const host=layer.current;if(!host)return;
  while(host.children.length>=24)host.firstElementChild?.remove();
  const rect=event.currentTarget.getBoundingClientRect(),image=document.createElement('img');
  image.src=src;image.alt='';image.className='work-banknote work-coin';
  image.style.left=`${rect.left+rect.width/2}px`;image.style.top=`${rect.top+8}px`;
  host.append(image);
  const n=serial.current++,drift=(((n*47)%131)-65)*Math.sqrt(intensity),tilt=((n*29)%71)-35;
  if(typeof image.animate!=="function"){image.style.transform="translate(-50%,-60%)";setTimeout(()=>image.remove(),350);return}
  const animation=image.animate(reduced?[
    {transform:'translate(-50%,-60%)',opacity:1},{transform:'translate(-50%,-60%)',opacity:0}
  ]:[
    {transform:'translate(-50%,-30%) rotate(-10deg) scale(.6)',opacity:1},
    {transform:`translate(calc(-50% + ${drift*.5}px),-100px) rotate(${tilt}deg) scale(1.15)`,opacity:1,offset:.35},
    {transform:`translate(calc(-50% + ${drift}px),-${230*Math.sqrt(intensity)}px) rotate(${tilt+70}deg) scale(.75)`,opacity:0}
  ],{duration:reduced?350:1150,easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'});
  animation.onfinish=()=>image.remove();
  if(!reduced && typeof event.currentTarget.animate==="function")event.currentTarget.animate([{transform:'translateY(0)'},{transform:'translateY(3px)'},{transform:'translateY(-2px)'},{transform:'translateY(0)'}],{duration:170});
 };
 return {burst,layer};
}
