/* Cargo+420 owner dashboard (installable PWA) */
const A={orders:[],customers:[],drivers:[],members:[],products:[],zones:[],settings:{},tiers:[],events:[]};
const SL={new:'New',confirmed:'Confirmed',out:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'};
const isToday=ts=>new Date(ts).toDateString()===new Date().toDateString();
const ago=ts=>{const m=Math.round((Date.now()-new Date(ts))/60000);if(m<1)return'just now';if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m ago';return Math.floor(h/24)+'d ago'};
const tierName=id=>(A.tiers.find(t=>t.id===id)||{name:id}).name;
const drvName=id=>(A.drivers.find(d=>d.id===id)||{}).name||'';
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let tab='orders',ordFilter='active',custQ='',invQ='',flashIds=new Set(),user=null,channel=null;
const V=()=>$('#view');

/* ---------- service worker + push ---------- */
let swReg=null;
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;if(user)render()}).catch(()=>{});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='push'&&document.visibilityState==='visible'){reloadData()}})}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function b64ToU8(s){const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))}
async function pushState(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return isIOS&&!standalone?'ios-install':'unsupported';
  if(isIOS&&!standalone)return'ios-install';
  if(Notification.permission==='denied')return'denied';
  const reg=swReg||await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  return sub?'on':'off';
}
async function enablePush(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Alerts are blocked','Allow notifications for this app in your phone settings, then try again.');return render()}
    const reg=swReg||await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(CFG.VAPID_PUBLIC)});
    const j=sub.toJSON();
    const label=(isIOS?'iPhone':/Android/.test(navigator.userAgent)?'Android':'Computer')+' · '+new Date().toLocaleDateString();
    const {error}=await sb.from('push_subscriptions').upsert({endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,user_id:user.id,label},{onConflict:'endpoint'});
    if(error)throw error;
    toast('Phone alerts are on','Every new order will buzz this device.',true);
  }catch(e){toast('Could not turn on alerts',errMsg(e))}
  render();
}
async function disablePush(){
  const reg=swReg||await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}
  toast('Alerts turned off on this device','',true);render();
}
async function testPush(){
  const {data:{session}}=await sb.auth.getSession();
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/notify-order',{method:'POST',headers:{'Content-Type':'application/json',apikey:CFG.SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:'{}'});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Test failed');
    toast(`Test sent to ${j.sent} device${j.sent===1?'':'s'}`,j.sent?'It should arrive in a few seconds.':'Turn on alerts on a device first.',true);
  }catch(e){toast('Test alert failed',errMsg(e))}
}

/* ---------- in-app chime ---------- */
let actx=null;
function unlockAudio(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume()}catch(e){}}
document.addEventListener('pointerdown',unlockAudio,{once:true});
function chime(){if(!actx)return;try{const t=actx.currentTime;[880,1320,1760].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.14);g.gain.linearRampToValueAtTime(.25,t+i*.14+.02);g.gain.exponentialRampToValueAtTime(.001,t+i*.14+.4);o.connect(g).connect(actx.destination);o.start(t+i*.14);o.stop(t+i*.14+.45)})}catch(e){}}

/* ---------- auth ---------- */
function vAuth(mode='in',msg=''){
  $('#signout').hidden=true;
  V().innerHTML=`<form class="authbox" id="authf" data-mode="${mode}"><img src="img/logo.webp" alt="">
   <h1 style="font-size:34px;text-align:center">${mode==='up'?'Create owner account':mode==='reset'?'Reset password':mode==='newpw'?'Set a new password':'Owner sign in'}</h1>
   ${mode!=='newpw'?'<label>Email<input id="a-email" type="email" autocomplete="username" required></label>':''}
   ${mode!=='reset'?`<label>Password<input id="a-pw" type="password" autocomplete="${mode==='in'?'current-password':'new-password'}" minlength="8" required></label>`:''}
   <button class="btn">${mode==='up'?'Create account':mode==='reset'?'Email me a reset link':mode==='newpw'?'Save password':'Sign in'}</button>
   ${msg?`<p class="warnbox">${esc(msg)}</p>`:''}
   <div class="row" style="justify-content:space-between">
    ${mode==='in'?'<button type="button" class="linkbtn" data-auth="reset">Forgot password?</button><button type="button" class="linkbtn" data-auth="up">First time? Create the owner account</button>':'<button type="button" class="linkbtn" data-auth="in">Back to sign in</button>'}
   </div>
   ${mode==='up'?'<p class="note">The first account created becomes the owner. Accounts made after that have no access until you add them.</p>':''}
  </form>`;
}
async function submitAuth(f){
  const mode=f.dataset.mode,email=$('#a-email')?.value.trim(),pw=$('#a-pw')?.value;
  const btn=f.querySelector('.btn');btn.disabled=true;
  let r;
  if(mode==='in')r=await sb.auth.signInWithPassword({email,password:pw});
  if(mode==='up'){r=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+'/admin.html'}});
    if(!r.error&&!r.data.session){return vAuth('in','Check your email and tap the confirmation link, then sign in here.')}}
  if(mode==='reset'){r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/admin.html'});if(!r.error)return vAuth('in','If that email has an account, a reset link is on its way.')}
  if(mode==='newpw'){r=await sb.auth.updateUser({password:pw});if(!r.error){toast('Password updated','',true);return boot()}}
  btn.disabled=false;
  if(r?.error)vAuth(mode,errMsg(r.error));
}

/* ---------- data ---------- */
async function reloadData(){
  const since=new Date(Date.now()-90*864e5).toISOString();
  const res=await Promise.all([
    sb.from('orders').select('*').or(`created_at.gte.${since},status.in.(new,confirmed,out)`).order('created_at',{ascending:false}).limit(3000),
    sb.from('customers').select('*').order('updated_at',{ascending:false}).limit(5000),
    sb.from('drivers').select('*').order('created_at'),
    sb.from('members').select('*').order('applied_at',{ascending:false}),
    sb.from('products').select('*').order('name'),
    sb.from('zones').select('*').order('sort'),
    sb.from('store_settings').select('*').eq('id',1).single(),
    sb.from('tiers').select('*').order('sort'),
    sb.from('events').select('*').order('starts_on')]);
  const bad=res.find(x=>x.error);if(bad)throw bad.error;
  [A.orders,A.customers,A.drivers,A.members,A.products,A.zones,A.settings,A.tiers,A.events]=res.map(x=>x.data);
  render();
}
function subscribe(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel('owner-live')
   .on('postgres_changes',{event:'*',schema:'public',table:'orders'},async p=>{
     if(p.eventType==='INSERT'){const o=p.new;if(!A.orders.some(x=>x.id===o.id))A.orders.unshift(o);flashIds.add(o.id);setTimeout(()=>flashIds.delete(o.id),8000);
       toast(`New order ${o.code} · ${money(o.total)}`,`${o.cust_name} · ${o.city} · cash`);chime();titleFlash();
       const {data}=await sb.from('customers').select('*').eq('phone',o.cust_phone).maybeSingle();if(data){A.customers=A.customers.filter(c=>c.id!==data.id);A.customers.unshift(data)}
       sb.from('products').select('*').order('name').then(r=>{if(r.data)A.products=r.data;render()});}
     else if(p.eventType==='UPDATE'){const i=A.orders.findIndex(x=>x.id===p.new.id);if(i>=0)A.orders[i]=p.new;else A.orders.unshift(p.new)}
     else if(p.eventType==='DELETE'){A.orders=A.orders.filter(x=>x.id!==p.old.id)}
     render();})
   .on('postgres_changes',{event:'*',schema:'public',table:'members'},p=>{
     if(p.eventType==='INSERT'){A.members.unshift(p.new);if(p.new.status==='pending'){toast('New membership application',`${p.new.name} · ${tierName(p.new.tier)}`);chime()}}
     else if(p.eventType==='UPDATE'){const i=A.members.findIndex(x=>x.id===p.new.id);if(i>=0)A.members[i]=p.new}
     else A.members=A.members.filter(x=>x.id!==p.old.id);
     render();})
   .subscribe(s=>{liveOk=s==='SUBSCRIBED';const el=$('#livetxt');if(el)el.textContent=liveOk?'Live':'Reconnecting…'});
}
let liveOk=false,titleTimer=null;
function titleFlash(){clearInterval(titleTimer);let k=0;titleTimer=setInterval(()=>{document.title=k++%2?'Cargo+420 Orders':'● New order';if(k>12){clearInterval(titleTimer);document.title='Cargo+420 Orders'}},900)}
async function upd(table,id,patch){
  const {data,error}=await sb.from(table).update(patch).eq('id',id).select().single();
  if(error){toast('Not saved',errMsg(error));return null}
  const arr=A[table];const i=arr.findIndex(x=>x.id===id);if(i>=0)arr[i]=data;return data;
}

/* ---------- shell ---------- */
async function render(){
  if(!user)return;
  const today=A.orders.filter(o=>isToday(o.created_at)&&o.status!=='cancelled');
  const sales=today.filter(o=>o.status==='delivered').reduce((s,o)=>s+Number(o.collected??o.total),0);
  const street=A.orders.filter(o=>o.status==='out').reduce((s,o)=>s+Number(o.total),0)+A.orders.filter(o=>o.status==='delivered'&&!o.cash_in).reduce((s,o)=>s+Number(o.collected??o.total),0);
  const nNew=A.orders.filter(o=>o.status==='new').length,pend=A.members.filter(m=>m.status==='pending').length,low=A.products.filter(p=>p.active&&p.stock<=3).length;
  const tabs=[['orders','Orders',nNew],['customers','Customers'],['drivers','Drivers & cash'],['inventory','Inventory',low],['members','Members',pend],['events','Events'],['reports','Reports'],['settings','Settings']];
  const ps=await pushState();
  const focus=document.activeElement?.id;
  V().innerHTML=`<div class="wrap adm">
   <div class="admtop"><div><span class="eyebrow">Cargo+420 · Owner dashboard</span><h1 style="font-size:40px">${tab==='orders'?'Live orders':tabs.find(t=>t[0]===tab)[1]}</h1></div>
    <div class="row"><span class="live"><i style="${liveOk?'':'background:var(--warn)'}"></i><span id="livetxt">${liveOk?'Live':'Connecting…'}</span></span>
     <button class="btn sm ${A.settings.open?'green':'red'}" id="openbtn">${A.settings.open?'Taking orders':'Closed · not taking orders'}</button></div></div>
   ${alertCard(ps)}
   <div class="kpis">
    <div class="kpi"><div class="l">Today's sales (collected)</div><div class="v">${money(sales)}</div></div>
    <div class="kpi"><div class="l">Orders today</div><div class="v">${today.length}</div></div>
    <div class="kpi"><div class="l">Avg ticket</div><div class="v">${money(today.length?today.reduce((s,o)=>s+Number(o.total),0)/today.length:0)}</div></div>
    <div class="kpi cash"><div class="l">Cash on the street</div><div class="v">${money(street)}</div></div>
   </div>
   <div class="tabs" role="tablist">${tabs.map(([id,l,b])=>`<button role="tab" class="${tab===id?'on':''}" data-tab="${id}">${l}${b?`<span class="b">${b}</span>`:''}</button>`).join('')}</div>
   <div id="admbody"></div></div>`;
  ({orders:aOrders,customers:aCustomers,drivers:aDrivers,inventory:aInventory,members:aMembers,events:aEvents,reports:aReports,settings:aSettings}[tab])($('#admbody'));
  if(focus&&$('#'+focus)){const el=$('#'+focus);el.focus();if(el.setSelectionRange&&typeof el.value==='string')try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}}
}
function alertCard(ps){
  if(ps==='on')return`<div class="row note" style="justify-content:flex-end"><span>🔔 Phone alerts are on for this device.</span><button class="linkbtn" id="testpush">Send test alert</button><button class="linkbtn" id="offpush">Turn off here</button></div>`;
  if(ps==='ios-install')return`<div class="install"><b>Get order alerts on this iPhone</b><ol><li>Tap the Share button in Safari.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>Cargo Orders</b> from your home screen, sign in, and tap <b>Turn on phone alerts</b>.</li></ol><span class="note">iPhone needs iOS 16.4 or newer.</span></div>`;
  if(ps==='denied')return`<div class="warnbox">Notifications are blocked for this app. Turn them on in your phone or browser settings for this site, then reload.</div>`;
  if(ps==='unsupported')return`<div class="note">This browser can't receive push alerts. Use Chrome on Android, Safari on iPhone (installed to the home screen), or Chrome/Edge/Safari on a computer.</div>`;
  return`<div class="install"><b>Get a buzz on your phone for every new order</b><span class="note">Works even when the app is closed. No text messages involved.</span><div class="row"><button class="btn" id="onpush">Turn on phone alerts</button>${!standalone&&!isIOS?'<span class="note">Tip: install this dashboard (browser menu → Install app / Add to Home screen) so it opens like an app.</span>':''}</div></div>`;
}

/* ---------- orders ---------- */
function aOrders(B){
  const act=o=>['new','confirmed','out'].includes(o.status);
  const match=(o,s)=>s==='active'?act(o):s==='today'?isToday(o.created_at):o.status===s;
  const fs=[['active','Active'],['new','New'],['confirmed','Confirmed'],['out','Out for delivery'],['delivered','Delivered'],['today','All today'],['cancelled','Cancelled']];
  let list=A.orders.filter(o=>match(o,ordFilter));if(ordFilter==='delivered'||ordFilter==='cancelled')list=list.slice(0,80);
  B.innerHTML=`<div style="display:grid;gap:12px"><div class="filters">${fs.map(([id,l])=>`<button class="${ordFilter===id?'on':''}" data-of="${id}">${l} <span class="num">${A.orders.filter(o=>match(o,id)).length}</span></button>`).join('')}</div>
  <div class="olist">${list.map(o=>{const c=A.customers.find(c=>c.id===o.customer_id);return`<article class="order s-${o.status} ${flashIds.has(o.id)?'flash':''}">
   <div><div class="row"><span class="id">${esc(o.code)}</span><span class="pill p-${o.status}">${SL[o.status]}</span></div><div class="meta">${new Date(o.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} · ${ago(o.created_at)}</div>
    <div style="margin-top:6px;font-weight:600">${esc(o.cust_name)} ${o.tier?`<span class="pill p-muted">${esc(tierName(o.tier))}</span>`:''}</div><div class="meta"><a href="tel:${esc(o.cust_phone.replace(/\D/g,''))}">${esc(o.cust_phone)}</a></div>
    ${c&&!c.id_verified?'<div class="meta" style="color:var(--warn)">ID not yet verified</div>':''}</div>
   <div><div class="meta">${esc(o.address)}, ${esc(o.city)} · <a href="https://maps.google.com/?q=${encodeURIComponent(o.address+', '+o.city+', MI')}" target="_blank" rel="noopener">Map</a></div>${o.notes?`<div class="meta" style="color:var(--yellow)">Note: ${esc(o.notes)}</div>`:''}
    <div class="items" style="margin-top:6px">${o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(' · ')}</div></div>
   <div><div class="tot">${money(o.total)}</div><div class="meta" style="text-align:right">${Number(o.discount)?`member −${money(o.discount)} · `:''}${Number(o.fee)?`fee ${money(o.fee)}`:'no fee'}</div>
    ${o.status==='delivered'?`<div class="meta" style="text-align:right">Cash ${o.cash_in?'turned in':'with '+esc(drvName(o.driver_id)||'driver')}</div>`:''}</div>
   <div class="acts">${o.status==='cancelled'||o.status==='delivered'?`<span class="meta">${o.driver_id?'Driver: '+esc(drvName(o.driver_id)):''}</span>`:`
    <select data-drv="${o.id}" aria-label="Assign driver"><option value="">Assign driver</option>${A.drivers.filter(d=>d.active||d.id===o.driver_id).map(d=>`<option value="${d.id}" ${o.driver_id===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    ${o.status==='new'?`<button class="btn sm" data-st="${o.id}" data-to="confirmed">Confirm order</button>`:''}
    ${o.status==='confirmed'?`<button class="btn sm" data-st="${o.id}" data-to="out" ${o.driver_id?'':'disabled title="Assign a driver first"'}>Send out</button>`:''}
    ${o.status==='out'?`<button class="btn green sm" data-st="${o.id}" data-to="delivered">Delivered · cash collected</button>`:''}
    <button class="btn red sm" data-cancel="${o.id}">Cancel</button>`}</div>
  </article>`}).join('')||'<p class="note">No orders here right now. New orders appear at the top with a chime and a phone alert.</p>'}</div></div>`;
}
/* ---------- customers ---------- */
function aCustomers(B){
  const stats={};A.orders.forEach(o=>{if(o.status==='cancelled'||!o.customer_id)return;const s=stats[o.customer_id]||(stats[o.customer_id]={n:0,spent:0,last:null});s.n++;s.spent+=Number(o.total);if(!s.last||o.created_at>s.last)s.last=o.created_at});
  let list=A.customers.map(c=>({...c,...(stats[c.id]||{n:0,spent:0,last:null}),m:A.members.find(m=>m.phone===c.phone&&m.status==='active')}));
  if(custQ)list=list.filter(c=>[c.name,c.phone,c.city,c.address].join(' ').toLowerCase().includes(custQ.toLowerCase()));
  B.innerHTML=`<div style="display:grid;gap:12px"><div class="row" style="justify-content:space-between"><input id="custq" placeholder="Search name, phone, city" value="${esc(custQ)}" style="max-width:320px"><span class="note">${list.length} customers · order stats cover the last 90 days</span></div>
  <div class="tblwrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Address</th><th class="r">Orders</th><th class="r">Spent</th><th>Last order</th><th>Membership</th><th>ID verified</th><th>Notes</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td class="mono"><a href="tel:${esc(c.phone.replace(/\D/g,''))}">${esc(c.phone)}</a></td><td>${esc(c.address||'')}${c.city?', '+esc(c.city):''}</td><td class="r num">${c.n}</td><td class="r num">${money(c.spent)}</td><td>${c.last?ago(c.last):'—'}</td>
   <td>${c.m?`<span class="pill p-new">${esc(tierName(c.m.tier))}</span>`:'<span class="note">—</span>'}</td>
   <td><label class="toggle"><input type="checkbox" data-idv="${c.id}" ${c.id_verified?'checked':''}> ${c.id_verified?'Yes':'No'}</label></td>
   <td><input data-cnote="${c.id}" value="${esc(c.notes||'')}" placeholder="Add note" style="min-width:200px"></td></tr>`).join('')||'<tr><td colspan="9" class="note">Customers appear here after their first order.</td></tr>'}</tbody></table></div></div>`;
}
/* ---------- drivers & cash ---------- */
function aDrivers(B){
  const sum=a=>a.reduce((s,o)=>s+Number(o.collected??o.total),0);
  const cards=A.drivers.filter(d=>d.active).map(d=>{const mine=A.orders.filter(o=>o.driver_id===d.id);const out=mine.filter(o=>o.status==='out'),conf=mine.filter(o=>o.status==='confirmed'),held=mine.filter(o=>o.status==='delivered'&&!o.cash_in),inT=mine.filter(o=>o.cash_in&&o.cash_in_at&&isToday(o.cash_in_at));
   return`<div class="dcard"><div class="row" style="justify-content:space-between"><h3>${esc(d.name)}</h3><button class="linkbtn" data-drvoff="${d.id}">Remove</button></div>
    <div class="kv"><span>Queued (confirmed)</span><b>${conf.length}</b></div>
    <div class="kv"><span>On route now</span><b>${out.length} · ${money(sum(out))} to collect</b></div>
    <div class="kv" style="color:var(--yellow)"><span>Cash in hand</span><b>${money(sum(held))}</b></div>
    <div class="kv"><span>Turned in today</span><b>${money(sum(inT))}</b></div>
    ${held.length?`<div class="note">${held.map(o=>esc(o.code)+' '+money(o.collected??o.total)).join(' · ')}</div>`:''}
    <button class="btn sm" data-cashin="${d.id}" ${held.length?'':'disabled'}>Cash turned in · ${money(sum(held))}</button></div>`}).join('');
  const un=A.orders.filter(o=>!o.driver_id&&['new','confirmed'].includes(o.status)).length;
  B.innerHTML=`<div style="display:grid;gap:14px">${un?`<div class="warnbox">${un} active order${un>1?'s':''} still need a driver. Assign from the Orders tab.</div>`:''}<div class="drivers">${cards||'<p class="note">Add your drivers below so you can assign orders and track cash.</p>'}</div>
   <form class="row" id="drvf"><input id="drv-name" placeholder="New driver name" style="max-width:240px" required><button class="btn ghost sm">Add driver</button></form></div>`;
}
/* ---------- inventory ---------- */
let editing=null;
function aInventory(B){
  let list=A.products.slice().sort((a,b)=>(b.active-a.active)||a.stock-b.stock||a.name.localeCompare(b.name));
  if(invQ)list=list.filter(p=>(p.name+' '+catName(p.cat)).toLowerCase().includes(invQ.toLowerCase()));
  B.innerHTML=`<div style="display:grid;gap:12px">
   <div class="row" style="justify-content:space-between"><input id="invq" placeholder="Search products" value="${esc(invQ)}" style="max-width:280px"><button class="btn sm" data-edit="new">Add product</button></div>
   <div id="pformwrap"></div>
   <p class="note" style="margin:0">Stock drops when an order is placed and comes back if you cancel it. At 0 the shop shows “Out of stock”.</p>
   <div class="tblwrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th class="r">Price</th><th class="r">Stock</th><th>Status</th><th>Hot</th><th>On menu</th><th></th></tr></thead><tbody>
  ${list.map(p=>`<tr style="${p.active?'':'opacity:.55'}"><td><div class="thumb">${art(p)}</div></td><td><b>${esc(p.name)}</b></td><td>${catName(p.cat)}</td><td class="r"><input class="n num" type="number" step="0.5" min="0" data-price="${p.id}" value="${Number(p.price)}"></td><td class="r"><input class="n num" type="number" min="0" data-stock="${p.id}" value="${p.stock}"></td>
   <td>${p.stock<=0?'<span class="pill p-cancelled">Sold out</span>':p.stock<=3?'<span class="pill p-out">Low</span>':'<span class="pill p-delivered">In stock</span>'}</td>
   <td><input type="checkbox" data-feat="${p.id}" ${p.featured?'checked':''} aria-label="Hot"></td><td><input type="checkbox" data-active="${p.id}" ${p.active?'checked':''} aria-label="On menu"></td><td><button class="linkbtn" data-edit="${p.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></div>`;
  if(editing)drawPForm();
}
function drawPForm(){
  const w=$('#pformwrap');if(!w)return;const p=editing==='new'?{name:'',cat:'flower',price:0,stock:0,tags:[],thc:'',size:'',strain:'',description:'',featured:false,active:true,image_url:null}:A.products.find(x=>x.id===editing);if(!p){editing=null;return}
  w.innerHTML=`<form class="pform" id="pform"><div class="row" style="justify-content:space-between"><h3 style="font-size:24px">${editing==='new'?'Add product':'Edit '+esc(p.name)}</h3><button type="button" class="x" data-edit="" aria-label="Close">×</button></div>
   <div class="two"><label>Name<input id="pf-name" required value="${esc(p.name)}"></label><label>Category<select id="pf-cat">${CATS.map(c=>`<option value="${c.id}" ${p.cat===c.id?'selected':''}>${c.name}</option>`).join('')}</select></label></div>
   <div class="three"><label>Price ($)<input id="pf-price" type="number" step="0.01" min="0" value="${Number(p.price)}"></label><label>Stock<input id="pf-stock" type="number" min="0" value="${p.stock}"></label><label>Size<input id="pf-size" value="${esc(p.size||'')}" placeholder="3.5g"></label></div>
   <div class="three"><label>THC / strength<input id="pf-thc" value="${esc(p.thc||'')}" placeholder="28% THC"></label><label>Strain type<input id="pf-strain" value="${esc(p.strain||'')}" placeholder="Hybrid"></label><label>Filters (comma separated)<input id="pf-tags" value="${esc(p.tags.join(', '))}" placeholder="Hybrid, 3.5 grams"></label></div>
   <label>Description<textarea id="pf-desc" rows="2">${esc(p.description||'')}</textarea></label>
   <div class="row"><div class="thumb" style="width:72px;height:72px">${art({...p,id:p.id||'new'})}</div><label style="flex:1">Photo (JPG, PNG or WebP, under 5 MB)<input id="pf-photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
   <div class="row"><label class="toggle"><input type="checkbox" id="pf-feat" ${p.featured?'checked':''}> Hot / most liked</label><label class="toggle"><input type="checkbox" id="pf-active" ${p.active?'checked':''}> Show on menu</label></div>
   <div class="row"><button class="btn" id="pf-save">Save product</button>${editing!=='new'?`<button type="button" class="btn red sm" data-pdel="${p.id}">Delete product</button><span id="pdel-c" hidden><button type="button" class="btn red sm" data-pdelyes="${p.id}">Yes, delete it</button></span>`:''}</div></form>`;
}
async function saveProduct(){
  const btn=$('#pf-save');btn.disabled=true;btn.textContent='Saving…';
  const rec={name:$('#pf-name').value.trim(),cat:$('#pf-cat').value,price:Math.max(0,+$('#pf-price').value||0),stock:Math.max(0,parseInt($('#pf-stock').value)||0),size:$('#pf-size').value.trim()||null,thc:$('#pf-thc').value.trim()||null,strain:$('#pf-strain').value.trim()||null,
    tags:$('#pf-tags').value.split(',').map(s=>s.trim()).filter(Boolean),description:$('#pf-desc').value.trim()||null,featured:$('#pf-feat').checked,active:$('#pf-active').checked};
  if(!rec.name){toast('Add a product name','',true);btn.disabled=false;btn.textContent='Save product';return}
  const file=$('#pf-photo').files[0];
  try{
    if(file){if(file.size>5*1024*1024)throw new Error('That photo is over 5 MB. Pick a smaller one.');
      const path=`${Date.now()}-${file.name.replace(/[^\w.-]+/g,'_')}`;
      const up=await sb.storage.from('products').upload(path,file,{cacheControl:'31536000',contentType:file.type});if(up.error)throw up.error;
      rec.image_url=sb.storage.from('products').getPublicUrl(path).data.publicUrl;}
    if(editing==='new'){const {data,error}=await sb.from('products').insert(rec).select().single();if(error)throw error;A.products.push(data)}
    else{const d=await upd('products',editing,rec);if(!d)throw new Error('Not saved')}
    toast('Product saved','It shows on the store right away.',true);editing=null;render();
  }catch(e){toast('Product not saved',errMsg(e));btn.disabled=false;btn.textContent='Save product'}
}
/* ---------- members ---------- */
const plusDays=(d,n)=>{const x=d?new Date(d+'T12:00'):new Date();const base=x<new Date()?new Date():x;base.setDate(base.getDate()+n);return base.toISOString().slice(0,10)};
function aMembers(B){
  const pend=A.members.filter(m=>m.status==='pending'),act=A.members.filter(m=>m.status==='active');
  const price=id=>Number((A.tiers.find(t=>t.id===id)||{}).price||0);
  const late=m=>m.next_due&&new Date(m.next_due+'T23:59')<new Date();
  B.innerHTML=`<div style="display:grid;gap:16px">
   <div class="kpis"><div class="kpi"><div class="l">Active members</div><div class="v">${act.length}</div></div><div class="kpi"><div class="l">Monthly dues</div><div class="v">${money(act.reduce((s,m)=>s+price(m.tier),0))}</div></div><div class="kpi"><div class="l">Applications</div><div class="v">${pend.length}</div></div><div class="kpi cash"><div class="l">Dues overdue</div><div class="v">${act.filter(late).length}</div></div></div>
   <h2 style="font-size:26px">Applications</h2>
   ${pend.length?`<div class="tblwrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Tier</th><th>Applied</th><th></th></tr></thead><tbody>${pend.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td class="mono"><a href="tel:${esc(m.phone.replace(/\D/g,''))}">${esc(m.phone)}</a></td><td>${esc(tierName(m.tier))}</td><td>${ago(m.applied_at)}</td><td class="row"><button class="btn green sm" data-mem="${m.id}" data-act="approve">Approve</button><button class="btn red sm" data-mem="${m.id}" data-act="decline">Decline</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No applications waiting.</p>'}
   <h2 style="font-size:26px">Active members</h2>
   ${act.length?`<div class="tblwrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Tier</th><th class="r">Dues</th><th>Next due</th><th></th></tr></thead><tbody>${act.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td class="mono">${esc(m.phone)}</td><td><span class="pill p-new">${esc(tierName(m.tier))}</span></td><td class="r num">${money(price(m.tier))}</td><td>${late(m)?'<span class="pill p-cancelled">Overdue</span> ':''}${m.next_due?new Date(m.next_due+'T12:00').toLocaleDateString():'—'}</td><td class="row"><button class="btn sm" data-mem="${m.id}" data-act="paid">Cash received · +30 days</button><button class="btn ghost sm" data-mem="${m.id}" data-act="end">End</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No active members yet. Approve an application to start.</p>'}</div>`;
}
/* ---------- events ---------- */
function aEvents(B){
  B.innerHTML=`<div style="display:grid;gap:14px"><div class="tblwrap"><table><thead><tr><th>Date</th><th>Event</th><th>Where</th><th>Access</th><th class="r">RSVPs</th><th></th></tr></thead><tbody>
  ${A.events.map(e=>`<tr><td>${new Date(e.starts_on+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${e.time_label?' · '+esc(e.time_label):''}</td><td><b>${esc(e.title)}</b></td><td>${esc(e.place||'')}</td><td>${e.members_only?'Members':'Open 21+'}</td><td class="r num">${e.rsvp_count}</td><td><button class="btn red sm" data-delev="${e.id}">Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="note">No events yet. Add one below and it shows on the Events page.</td></tr>'}</tbody></table></div>
  <form class="form" id="evf" style="max-width:none"><h2 style="font-size:26px">Add event</h2><div class="two"><label>Title<input id="ev-title" required></label><label>Date<input id="ev-date" type="date" required></label></div>
   <div class="two"><label>Time<input id="ev-time" placeholder="7–10 PM"></label><label>Location (shown publicly)<input id="ev-place" placeholder="Midtown Detroit · address sent to RSVPs"></label></div>
   <label>Description<input id="ev-desc"></label><label class="check"><input type="checkbox" id="ev-mem"> <span>Members only</span></label><button class="btn" style="justify-self:start">Publish event</button></form></div>`;
}
/* ---------- reports ---------- */
function aReports(B){
  const days=[];for(let d=6;d>=0;d--){const t=new Date();t.setDate(t.getDate()-d);const ds=t.toDateString();const os=A.orders.filter(o=>o.status==='delivered'&&new Date(o.delivered_at||o.created_at).toDateString()===ds);days.push({lbl:t.toLocaleDateString('en-US',{weekday:'short'}),v:os.reduce((s,o)=>s+Number(o.collected??o.total),0),n:os.length})}
  const hrs=[];for(let h=10;h<=23;h++){const os=A.orders.filter(o=>isToday(o.created_at)&&o.status!=='cancelled'&&new Date(o.created_at).getHours()===h);hrs.push({lbl:h>12?(h-12)+'p':h===12?'12p':h+'a',v:os.reduce((s,o)=>s+Number(o.total),0)})}
  const top={};A.orders.filter(o=>o.status==='delivered').forEach(o=>o.items.forEach(i=>{top[i.name]=(top[i.name]||0)+i.price*i.qty}));
  const topL=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,8);
  B.innerHTML=`<div style="display:grid;gap:16px"><div class="kpis"><div class="kpi"><div class="l">7-day sales</div><div class="v">${money0(days.reduce((s,d)=>s+d.v,0))}</div></div><div class="kpi"><div class="l">7-day orders</div><div class="v">${days.reduce((s,d)=>s+d.n,0)}</div></div><div class="kpi"><div class="l">Best day</div><div class="v">${days.some(d=>d.v)?days.slice().sort((a,b)=>b.v-a.v)[0].lbl:'—'}</div></div><div class="kpi"><div class="l">Customers</div><div class="v">${A.customers.length}</div></div></div>
  <div class="cols"><div class="chart"><div class="eyebrow">Sales collected · last 7 days</div>${bars(days,'var(--yellow)')}</div><div class="chart"><div class="eyebrow">Today's orders by hour ($)</div>${bars(hrs,'var(--green)')}</div></div>
  <div class="cols"><div class="chart"><div class="eyebrow">Top products by revenue · 90 days</div><div style="display:grid;gap:6px;margin-top:10px">${topL.map(([n,v])=>`<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(n)}</span><span class="num">${money0(v)}</span></div><div style="height:6px;background:var(--panel2);border-radius:3px"><div style="height:6px;border-radius:3px;background:var(--yellow);width:${(v/topL[0][1]*100).toFixed(1)}%"></div></div></div>`).join('')||'<p class="note">Delivered orders will show here.</p>'}</div></div>
   <div class="chart" style="display:grid;gap:10px;align-content:start"><div class="eyebrow">Export</div><p class="note" style="margin:0">Download orders as a spreadsheet file (opens in Excel or Google Sheets).</p><div class="row"><button class="btn sm" data-csv="today">Today's orders</button><button class="btn ghost sm" data-csv="90">Last 90 days</button></div></div></div></div>`;
}
function bars(data,color){
  const W=520,H=200,pl=48,pb=24,pt=12,max=Math.max(1,...data.map(d=>d.v));
  const step=max>4000?1000:max>2000?500:max>800?200:max>300?100:max>100?50:25;const top=Math.ceil(max/step)*step;
  const bw=(W-pl-8)/data.length;let s='';
  for(let v=0;v<=top;v+=step){const y=pt+(H-pt-pb)*(1-v/top);s+=`<line x1="${pl}" x2="${W-4}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-6}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="JetBrains Mono,monospace">$${v.toLocaleString()}</text>`}
  data.forEach((d,i)=>{const h=(H-pt-pb)*d.v/top;const x=pl+i*bw+bw*.18;s+=`<rect x="${x}" y="${H-pb-h}" width="${bw*.64}" height="${Math.max(0,h)}" rx="2" fill="${color}" opacity="${i===data.length-1?1:.75}"><title>${d.lbl}: ${money(d.v)}</title></rect><text x="${x+bw*.32}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.lbl}</text>`});
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart" style="width:100%;height:auto">${s}</svg>`;
}
function downloadCsv(which){
  const rows=[['order','placed','status','customer','phone','address','city','items','subtotal','discount','fee','total','collected','driver','cash_turned_in']];
  A.orders.filter(o=>which==='today'?isToday(o.created_at):true).forEach(o=>rows.push([o.code,new Date(o.created_at).toLocaleString(),o.status,o.cust_name,o.cust_phone,o.address,o.city,o.items.map(i=>i.qty+'x '+i.name).join('; '),o.subtotal,o.discount,o.fee,o.total,o.collected??'',drvName(o.driver_id),o.cash_in?'yes':'no']));
  const csv=rows.map(r=>r.map(v=>{v=String(v??'');return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`cargo420-orders-${which}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();
}
/* ---------- settings ---------- */
function aSettings(B){
  B.innerHTML=`<form class="form" id="setf" style="max-width:820px"><h2 style="font-size:26px">Store</h2>
   <div class="two"><label>Delivery hours (shown on the site)<input id="s-hours" value="${esc(A.settings.hours)}"></label><label>Minimum order, every city ($)<input id="s-base" type="number" min="0" value="${Number(A.settings.base_min)}"></label></div>
   <label>Re-delivery fee wording<input id="s-redel" value="${esc(A.settings.redeliver)}"></label>
   <h2 style="font-size:26px;margin-top:10px">Delivery zones</h2><p class="note" style="margin:0">If an order is under the zone minimum, the fee is added. Cities are comma separated and show in the checkout city list.</p>
   ${A.zones.map(z=>`<div class="pform"><div class="two"><label>Zone minimum ($)<input type="number" min="0" data-zmin="${z.id}" value="${Number(z.min_order)}"></label><label>Fee if under minimum ($)<input type="number" min="0" data-zfee="${z.id}" value="${Number(z.fee)}"></label></div><label>Cities<textarea rows="2" data-zcities="${z.id}">${esc(z.cities.join(', '))}</textarea></label></div>`).join('')}
   <h2 style="font-size:26px;margin-top:10px">Membership tiers</h2>
   ${A.tiers.map(t=>`<div class="pform"><b>${esc(t.name)}</b><div class="two"><label>Monthly dues ($)<input type="number" min="0" data-tprice="${t.id}" value="${Number(t.price)}"></label><label>Discount (%)<input type="number" min="0" max="90" data-tpct="${t.id}" value="${t.pct_off}"></label></div><label class="toggle"><input type="checkbox" data-twaive="${t.id}" ${t.waive_fee?'checked':''}> Waive the under-minimum delivery fee</label><label>Perks (one per line)<textarea rows="3" data-tperks="${t.id}">${esc(t.perks.join('\n'))}</textarea></label></div>`).join('')}
   <button class="btn" style="justify-self:start">Save settings</button></form>`;
}
async function saveSettings(){
  try{
    let r=await sb.from('store_settings').update({hours:$('#s-hours').value.trim(),redeliver:$('#s-redel').value.trim(),base_min:Math.max(0,+$('#s-base').value||0),updated_at:new Date().toISOString()}).eq('id',1);if(r.error)throw r.error;
    for(const z of A.zones){r=await sb.from('zones').update({min_order:+$(`[data-zmin="${z.id}"]`).value||0,fee:+$(`[data-zfee="${z.id}"]`).value||0,cities:$(`[data-zcities="${z.id}"]`).value.split(',').map(s=>s.trim()).filter(Boolean)}).eq('id',z.id);if(r.error)throw r.error}
    for(const t of A.tiers){r=await sb.from('tiers').update({price:+$(`[data-tprice="${t.id}"]`).value||0,pct_off:Math.min(90,Math.max(0,parseInt($(`[data-tpct="${t.id}"]`).value)||0)),waive_fee:$(`[data-twaive="${t.id}"]`).checked,perks:$(`[data-tperks="${t.id}"]`).value.split('\n').map(s=>s.trim()).filter(Boolean)}).eq('id',t.id);if(r.error)throw r.error}
    toast('Settings saved','The store uses them right away.',true);await reloadData();
  }catch(e){toast('Settings not saved',errMsg(e))}
}

/* ---------- interactions ---------- */
let pendingCancel=null;
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,a');if(!t)return;
  if(t.dataset.auth){vAuth(t.dataset.auth);return}
  if(t.id==='signout'){await sb.auth.signOut();location.reload();return}
  if(t.dataset.tab){tab=t.dataset.tab;history.replaceState(null,'','#'+tab);render();return}
  if(t.dataset.of){ordFilter=t.dataset.of;render();return}
  if(t.id==='onpush'){enablePush();return}
  if(t.id==='offpush'){disablePush();return}
  if(t.id==='testpush'){testPush();return}
  if(t.id==='openbtn'){const d=await sb.from('store_settings').update({open:!A.settings.open}).eq('id',1).select().single();if(d.error)return toast('Not saved',errMsg(d.error));A.settings=d.data;toast(A.settings.open?'Store is taking orders':'Store closed','',true);render();return}
  if(t.dataset.st){t.disabled=true;const o=await upd('orders',t.dataset.st,{status:t.dataset.to});if(o){toast(`${o.code} → ${SL[o.status]}`,'',true);if(o.status==='delivered'){const c=A.customers.find(c=>c.id===o.customer_id);if(c)c.id_verified=true}}render();return}
  if(t.dataset.cancel){if(pendingCancel!==t.dataset.cancel){pendingCancel=t.dataset.cancel;t.textContent='Tap again to cancel';setTimeout(()=>{if(pendingCancel===t.dataset.cancel){pendingCancel=null;t.textContent='Cancel'}},4000);return}
    pendingCancel=null;const o=await upd('orders',t.dataset.cancel,{status:'cancelled'});if(o)toast(`${o.code} cancelled`,'Items were put back in stock.',true);render();return}
  if(t.dataset.cashin){const ids=A.orders.filter(o=>o.driver_id===t.dataset.cashin&&o.status==='delivered'&&!o.cash_in).map(o=>o.id);
    const {data,error}=await sb.from('orders').update({cash_in:true}).in('id',ids).select();if(error)return toast('Not saved',errMsg(error));
    data.forEach(n=>{const i=A.orders.findIndex(x=>x.id===n.id);if(i>=0)A.orders[i]=n});toast('Cash turned in and logged','',true);render();return}
  if(t.dataset.drvoff){await upd('drivers',t.dataset.drvoff,{active:false});render();return}
  if(t.dataset.mem){const act=t.dataset.act,m=A.members.find(x=>x.id===t.dataset.mem);const patch=act==='approve'?{status:'active',next_due:plusDays(null,30)}:act==='decline'?{status:'declined'}:act==='paid'?{next_due:plusDays(m.next_due,30)}:{status:'ended'};
    const d=await upd('members',m.id,patch);if(d)toast(act==='approve'?`${d.name} approved`:act==='paid'?`Dues logged for ${d.name}`:'Membership updated',act==='approve'?'Collect the first month in cash on their next delivery.':'',true);render();return}
  if(t.dataset.delev){const {error}=await sb.from('events').delete().eq('id',t.dataset.delev);if(error)return toast('Not removed',errMsg(error));A.events=A.events.filter(x=>x.id!==t.dataset.delev);render();return}
  if(t.dataset.edit!==undefined){editing=t.dataset.edit||null;if(editing){aInventory($('#admbody'));$('#pformwrap').scrollIntoView({behavior:'smooth',block:'start'})}else{const w=$('#pformwrap');if(w)w.innerHTML=''}return}
  if(t.dataset.pdel){$('#pdel-c').hidden=false;return}
  if(t.dataset.pdelyes){const {error}=await sb.from('products').delete().eq('id',t.dataset.pdelyes);if(error)return toast('Not deleted',errMsg(error));A.products=A.products.filter(p=>p.id!==t.dataset.pdelyes);editing=null;render();return}
  if(t.dataset.csv){downloadCsv(t.dataset.csv);return}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.drv){await upd('orders',t.dataset.drv,{driver_id:t.value||null});render();return}
  if(t.dataset.idv){await upd('customers',t.dataset.idv,{id_verified:t.checked});render();return}
  if(t.dataset.cnote){if(await upd('customers',t.dataset.cnote,{notes:t.value.trim()||null}))toast('Note saved','',true);return}
  if(t.dataset.price){await upd('products',t.dataset.price,{price:Math.max(0,+t.value||0)});return}
  if(t.dataset.stock){await upd('products',t.dataset.stock,{stock:Math.max(0,parseInt(t.value)||0)});render();return}
  if(t.dataset.feat){await upd('products',t.dataset.feat,{featured:t.checked});return}
  if(t.dataset.active){await upd('products',t.dataset.active,{active:t.checked});render();return}
});
let qT;
document.addEventListener('input',e=>{
  if(e.target.id==='custq'){clearTimeout(qT);qT=setTimeout(()=>{custQ=e.target.value;render()},250)}
  if(e.target.id==='invq'){clearTimeout(qT);qT=setTimeout(()=>{invQ=e.target.value;render()},250)}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  if(f.id==='authf')return submitAuth(f);
  if(f.id==='drvf'){const n=$('#drv-name').value.trim();if(!n)return;const {data,error}=await sb.from('drivers').insert({name:n}).select().single();if(error)return toast('Not saved',errMsg(error));A.drivers.push(data);render();return}
  if(f.id==='evf'){const rec={title:$('#ev-title').value.trim(),starts_on:$('#ev-date').value,time_label:$('#ev-time').value.trim()||null,place:$('#ev-place').value.trim()||null,description:$('#ev-desc').value.trim()||null,members_only:$('#ev-mem').checked};
    if(!rec.title||!rec.starts_on)return toast('Add a title and date','',true);
    const {data,error}=await sb.from('events').insert(rec).select().single();if(error)return toast('Not saved',errMsg(error));A.events.push(data);A.events.sort((a,b)=>a.starts_on.localeCompare(b.starts_on));toast('Event published','It now shows on the Events page.',true);render();return}
  if(f.id==='pform')return saveProduct();
  if(f.id==='setf')return saveSettings();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)reloadData().catch(()=>{})});
setInterval(()=>{if(user&&tab==='orders'&&!document.activeElement?.matches('input,select,textarea'))render()},60000);

/* ---------- boot ---------- */
let booting=false;
async function boot(){if(booting)return;booting=true;try{await bootInner()}finally{booting=false}}
async function bootInner(){
  const h=location.hash.slice(1);if(['orders','customers','drivers','inventory','members','events','reports','settings'].includes(h))tab=h;
  const {data:{session}}=await sb.auth.getSession();
  if(!session){user=null;return vAuth('in')}
  user=session.user;
  const {data:ok}=await sb.rpc('is_admin');
  if(!ok){V().innerHTML=`<div class="authbox"><h1 style="font-size:30px">No owner access</h1><p class="note">${esc(user.email)} is signed in but isn't set up as an owner. Ask the owner to add this account.</p><button class="btn ghost" id="signout2">Sign out</button></div>`;$('#signout2').onclick=async()=>{await sb.auth.signOut();location.reload()};return}
  $('#signout').hidden=false;
  try{await reloadData();subscribe()}catch(e){V().innerHTML=`<div class="wrap loading">Couldn't load the dashboard. ${esc(errMsg(e))}</div>`}
}
sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY'){user=null;vAuth('newpw')}else if(ev==='SIGNED_IN'&&!user)boot()});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==tab&&user){tab=h;render()}});
boot();
