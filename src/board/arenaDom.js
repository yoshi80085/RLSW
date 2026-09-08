// CSS3D temporarily reparents the live SVG. React can remove its former next
// sibling before effect cleanup, so restoration must tolerate that removal.
export function preserveTacticalLayer(element) {
  const parent = element.parentNode;
  const next = element.nextSibling;
  const style = element.getAttribute('style');
  return () => {
    parent.insertBefore(element, next?.parentNode === parent ? next : null);
    if (style == null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  };
}

// Delay LEFT capture until a real drag. A tap keeps its original SVG target;
// a drag is handed to OrbitControls and must never become a gameplay click.
export function keepGameplayClicks(element) {
  const document=element.ownerDocument;
  let pending=null,forwarding=false,suppressClick=false;
  const handler = event => {
    if(forwarding)return;
    suppressClick=false;
    if(event.pointerType!=='mouse'){event.stopImmediatePropagation();return;}
    if(event.button!==0)return;
    pending={pointerId:event.pointerId,x:event.clientX,y:event.clientY,dragged:false};
    event.stopImmediatePropagation();
  };
  const move=event=>{
    if(!pending||event.pointerId!==pending.pointerId||pending.dragged)return;
    if(Math.hypot(event.clientX-pending.x,event.clientY-pending.y)<6)return;
    pending.dragged=true;suppressClick=true;
    // Same active pointer ID lets OrbitControls capture subsequent real moves.
    const PointerEvent=document.defaultView.PointerEvent;
    forwarding=true;
    try {element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,
      pointerId:event.pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:1,
      clientX:pending.x,clientY:pending.y}));}finally{forwarding=false;}
    event.preventDefault();
  };
  const up=event=>{if(event.pointerId===pending?.pointerId)pending=null;};
  const click=event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}};
  element.addEventListener('pointerdown', handler, true);
  document.addEventListener('pointermove',move,true);
  document.addEventListener('pointerup',up,true);
  document.addEventListener('pointercancel',up,true);
  element.addEventListener('click',click,true);
  return () => {
    element.removeEventListener('pointerdown',handler,true);
    document.removeEventListener('pointermove',move,true);
    document.removeEventListener('pointerup',up,true);
    document.removeEventListener('pointercancel',up,true);
    element.removeEventListener('click',click,true);
  };
}
