/* Cargo+420 storefront */
const HOME_CATS=['flower','edibles','cbd','concentrates','mushrooms','vapes','enhance'];
const D={products:[],zones:[],settings:{},tiers:[],events:[],zips:{}};
const prod=id=>D.products.find(p=>p.id===id);
const choices=p=>p&&p.options&&Array.isArray(p.options.choices)?p.options.choices:null;
const choiceOf=(p,opt)=>(choices(p)||[]).find(c=>c.label===opt)||null;
const itemPrice=(p,opt)=>{const c=choiceOf(p,opt);return c?Number(c.price):Number(p.price)};
const itemStock=(p,opt)=>{const c=choiceOf(p,opt);return c?Number(c.stock):Number(p.stock)};
const fromPrice=p=>{const ch=choices(p);if(!ch)return money(p.price);const ps=ch.map(c=>Number(c.price)),lo=Math.min(...ps);return (Math.max(...ps)>lo?'From ':'')+money(lo)};
const allCities=()=>D.zones.flatMap(z=>z.cities).sort((a,b)=>a.localeCompare(b));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let cart=store.get('c420cart',[]);
function saveCart(){cart=cart.filter(x=>{const p=prod(x.id);return p&&x.qty>0&&(!choices(p)||choiceOf(p,x.opt))});store.set('c420cart',cart);$('#cartn').textContent=cart.reduce((s,x)=>s+x.qty,0)}

async function loadAll(){
  const [p,z,s,t,e,zz]=await Promise.all([
    sb.from('products').select('*').eq('active',true).order('created_at',{ascending:false}),
    sb.from('zones').select('*').order('sort'),
    sb.from('store_settings').select('*').eq('id',1).single(),
    sb.from('tiers').select('*').order('sort'),
    sb.from('events').select('*').gte('starts_on',new Date(Date.now()-864e5).toISOString().slice(0,10)).order('starts_on'),
    sb.from('zip_codes').select('zip,city')]);
  const err=[p,z,s,t,e].find(x=>x.error);if(err)throw err.error;
  D.products=p.data;D.zones=z.data;D.settings=s.data;D.tiers=t.data;D.events=e.data;
  D.zips={};(zz.data||[]).forEach(r=>D.zips[r.zip]=r.city);
}

/* ---------- routing ---------- */
let route='home',shopFilter={type:'all',val:null},sortBy='newest',q='';
function go(){
  const h=(location.hash||'#home').slice(1);
  route=['home','shop','members','events','areas','checkout','done'].includes(h)?h:'home';
  if(CATS.some(c=>c.id===h)){route='shop';shopFilter={type:'cat',val:h}}
  render();window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{$('#nav').classList.remove('open');$('#menubtn')?.setAttribute('aria-expanded','false');go()});
function render(){
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===route));
  const b=$('#banner');
  if(!D.settings.open){b.className='banner closed';b.textContent='We are closed right now and not taking orders. Hours: '+D.settings.hours}
  else{b.className='banner';b.textContent=`Cash on delivery only · $${Number(D.settings.base_min)} minimum on every order · Valid 21+ ID checked at delivery · Hours ${D.settings.hours}`}
  ({home:vHome,shop:vShop,members:vMembers,events:vEvents,areas:vAreas,checkout:vCheckout,done:vDone}[route])($('#view'));
  saveCart();
}

/* ---------- home ---------- */
function vHome(V){
  V.innerHTML=`<div class="wrap">
  <section class="hero"><img src="img/logo.webp" alt="Cargo+420 Exclusive Delivery Service"><p>Metro Detroit cannabis delivery. Pick a category, build your order, pay cash at the door.</p>
   <button class="zipchip" id="zipchip">${myZip?`${ICONS.pin}<span>Delivering to <b>${esc(myZip.city)} ${esc(myZip.zip)}</b></span><u>Change</u>`:`${ICONS.pin}<span>Do we deliver to you?</span><u>Check your ZIP</u>`}</button></section>
  <nav class="catgrid" aria-label="Shop by category">
   ${HOME_CATS.map(id=>{const c=CATS.find(x=>x.id===id);return`<a class="catbtn" href="#${id}">${ICONS[id]}<span>${c.name}</span><small>${c.blurb}</small></a>`}).join('')}
   <a class="catbtn all" href="#shop">${ICONS.all}<span>Shop all</span><small>${D.products.length} products</small></a>
  </nav>
  <div class="strip">
   <div><b>Cash on delivery</b><p>No cards, no apps. Have cash ready when your driver arrives.</p></div>
   <div><b>21+ with ID</b><p>Meet your driver at their vehicle with a valid government ID.</p></div>
   <div><b>Members save up to ${Math.max(0,...D.tiers.map(t=>t.pct_off))}%</b><p>${D.tiers.map(t=>t.name).join(', ')}. <a href="#members">See membership</a>.</p></div>
  </div>
  <div class="steps">
   <div><b>1. Browse</b><span>Open the menu or tap a category.</span></div>
   <div><b>2. Add to cart</b><span>Pick sizes and quantities.</span></div>
   <div><b>3. Review</b><span>Adjust or remove items.</span></div>
   <div><b>4. Check out</b><span>Name, phone, address. We call or text to confirm.</span></div>
   <div><b>5. Receive</b><span>Driver sends an ETA. Show ID, pay cash.</span></div>
  </div></div>`;
}
function vAreas(V){
  const base=Number(D.settings.base_min);
  V.innerHTML=`<div class="sa">
  <section class="sa-hero"><div class="wrap">
   <div class="sa-plate">
    <span class="sa-stars">★ ★ ★ &nbsp;Exclusive delivery service&nbsp; ★ ★ ★</span>
    <h1>Do we pull up<br>to your door?</h1>
    <form class="sa-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">Your ZIP code</label>
     <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="ZIP code" value="${esc(myZip?.zip||'')}">
     <button>Check</button></form>
    <button type="button" class="sa-loc" id="zip-loc">${ICONS.plane}<span>Use my current location</span></button>
   </div>
   <div id="zip-out" data-v="plate" aria-live="polite">${myZip?zipResult(myZip.zip,'plate'):''}</div>
  </div></section>

  <section class="wrap sa-map">
   <div class="sa-maphead"><span class="eyebrow">Delivery zones</span><h2>The farther the drive,<br>the bigger the minimum.</h2>
    <p>Every order needs at least $${base}. Under your city's minimum? You can still order with a delivery fee.</p></div>
   <div class="sa-grid">
    <div class="sa-rings">${ringsSvg()}</div>
    <div class="sa-zones">${D.zones.map((z,i)=>`<article class="sa-zone" data-zone="${z.id}">
      <header><span class="sa-n">Zone ${i+1}</span><b>$${Number(z.min_order)}</b><span class="sa-fee">${Number(z.fee)?`minimum · $${Number(z.fee)} fee if under`:'minimum · no fee'}</span></header>
      <div class="sa-chips">${z.cities.map(c=>`<span class="sa-chip${myZip?.city===c?' hit':''}" data-city="${esc(c)}">${esc(c)}</span>`).join('')}</div></article>`).join('')}</div>
   </div>
  </section>

  <section class="wrap sa-rules">
   <div><b>$${base}</b><span>Minimum on every order, every city.</span></div>
   <div><b>Cash</b><span>Pay your driver at the door. Exact change helps.</span></div>
   <div><b>21+ ID</b><span>Meet your driver at their vehicle with a valid ID.</span></div>
   <div><b>Missed it?</b><span>Re-delivery fee of ${esc(D.settings.redeliver)}.</span></div>
  </section></div>`;
}
function ringsSvg(){
  const n=D.zones.length,R=188,r0=48,step=n>1?(R-r0)/(n-1):0,hitZ=myZip&&zoneForCity(myZip.city);
  let g='';
  for(let i=n-1;i>=0;i--){const z=D.zones[i],r=r0+i*step,hit=hitZ&&hitZ.id===z.id;
    g+=`<circle cx="200" cy="200" r="${r}" class="ring${i===0?' core':''}${hit?' hit':''}" data-zone="${z.id}" style="--o:${(0.05+0.05*(n-1-i)).toFixed(2)}"/>`;
    if(i>0)g+=`<g class="rlab${hit?' hit':''}"><rect x="${200-26}" y="${200-r+6}" width="52" height="22" rx="11"/><text x="200" y="${200-r+21.5}" text-anchor="middle">$${Number(z.min_order)}</text></g>`;}
  const z0=D.zones[0];
  return `<svg viewBox="0 0 400 400" role="img" aria-label="Delivery zones radiating out from Detroit, minimum order rising with distance">${g}
   <text x="200" y="196" text-anchor="middle" class="cmin">$${z0?Number(z0.min_order):''}</text><text x="200" y="216" text-anchor="middle" class="ccity">DETROIT</text>
   <path d="M200 228v14M193 235h14" class="cross"/></svg>`;
}

/* ---------- ZIP checker ---------- */
let myZip=store.get('c420zip',null);
const zoneForCity=city=>D.zones.filter(z=>z.cities.includes(city)).sort((a,b)=>a.min_order-b.min_order)[0]||null;
function zipChecker(variant){
  const val=esc(myZip?.zip||''),out=`<div id="zip-out" aria-live="polite">${myZip?zipResult(myZip.zip):''}</div>`;
  if(variant==='light')return `<div class="jz-in">
   <a class="jz-back" href="#home" aria-label="Back to home">${ICONS.back}</a>
   <div class="jz-ill">${ICONS.route}</div>
   <h2 class="jz-title">Your Delivery, Your Way</h2>
   <p class="jz-sub">Discreet home delivery across Metro Detroit.<br>Cash at the door, 21+ with ID.</p>
   <div class="jz-toggle" role="tablist" aria-label="Order type"><button type="button" role="tab" aria-selected="false" id="jz-pickup">Pickup</button><button type="button" role="tab" aria-selected="true" class="on">Delivery</button></div>
   <div class="jz-row"><span class="jz-pin">${ICONS.pin}</span><div><b>Add an address for delivery</b><small>Please enter your ZIP code &amp; enjoy delivery</small></div></div>
   <form class="jz-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">ZIP code</label>
    <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="Search ZIP code" value="${val}">
    <button aria-label="Check ZIP code">${ICONS.search}</button></form>
   <button type="button" class="jz-loc" id="zip-loc">${ICONS.plane}<span>Use My Current Location</span></button>
   ${out}</div>`;
  return `<div class="zc">
   <div class="zc-icon">${ICONS.route}</div>
   <h2>Your order, your door</h2>
   <p class="zc-sub">Discreet home delivery across Metro Detroit. Enter your ZIP code to see if we deliver to you and what your minimum is.</p>
   <form class="zc-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">ZIP code</label>
    <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="Enter your ZIP code" value="${val}">
    <button aria-label="Check ZIP code">${ICONS.search}</button></form>
   <button type="button" class="zc-loc" id="zip-loc">${ICONS.plane}<span>Use my current location</span></button>
   ${out}</div>`;
}
function zipResult(zip,v){
  const city=D.zips[zip];const z=city&&zoneForCity(city);
  if(v==='plate'){
    if(!z)return`<div class="sa-ticket no"><div class="t-main"><small>Out of range</small><b>${esc(zip)}</b><span>We don't deliver here yet. See the zones below for where we go.</span></div></div>`;
    const m=Number(z.min_order),f=Number(z.fee),i=D.zones.indexOf(z)+1;
    return`<div class="sa-ticket yes"><div class="t-main"><small>We deliver to</small><b>${esc(city)}</b><span>${esc(zip)} · Zone ${i}</span></div>
     <div class="t-stub"><div><small>Minimum</small><b>$${m}</b></div><div><small>Fee if under</small><b>${f?'$'+f:'None'}</b></div><a class="btn" href="#shop">Start shopping →</a></div></div>`;
  }
  if(!z)return`<div class="zc-res no"><b>We don't deliver to ${esc(zip)} yet.</b><span>We're growing. Check the city list below, or follow us for new areas.</span></div>`;
  const m=Number(z.min_order),f=Number(z.fee),base=Number(D.settings.base_min);
  return`<div class="zc-res yes"><b>Yes! We deliver to ${esc(city)} (${esc(zip)}).</b>
   <span>${m>base&&f?`Orders of $${m}+ deliver free. Under $${m}, a $${f} delivery fee applies (minimum order $${base}).`:`Minimum order $${m}. No delivery fee.`}</span>
   <a class="btn" href="#shop">Start shopping</a></div>`;
}
function checkZip(zip){
  zip=String(zip||'').replace(/\D/g,'').slice(0,5);const out=$('#zip-out');
  if(zip.length!==5){out.innerHTML='<div class="zc-res no"><b>Enter a 5-digit ZIP code.</b></div>';return}
  const city=D.zips[zip];
  if(city){myZip={zip,city};store.set('c420zip',myZip);co.city=city;store.set('c420co',{...co,age:undefined})}
  out.innerHTML=zipResult(zip,out.dataset.v);
  document.querySelectorAll('.sa-chip').forEach(c=>c.classList.toggle('hit',c.dataset.city===city));
  const hz=city&&zoneForCity(city);document.querySelectorAll('.sa-rings .ring,.sa-zone').forEach(c=>c.classList.toggle('hit',!!hz&&+c.dataset.zone===hz.id));
  document.querySelectorAll('.sa-rings .rlab').forEach(l=>l.classList.remove('hit'));
  const chip=$('#zipchip');if(chip&&city)chip.innerHTML=`${ICONS.pin}<span>Delivering to <b>${esc(city)} ${esc(zip)}</b></span><u>Change</u>`;
}
function useLocation(){
  const out=$('#zip-out');
  if(!navigator.geolocation){out.innerHTML='<div class="zc-res no"><b>Your browser can\'t share location.</b><span>Type your ZIP code instead.</span></div>';return}
  out.innerHTML='<div class="zc-res"><span>Finding your location…</span></div>';
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const {latitude:la,longitude:lo}=pos.coords;
      const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`);
      const j=await r.json();const zip=(j.postcode||'').slice(0,5);
      if(!zip)throw new Error('no zip');
      $('#zip-in').value=zip;checkZip(zip);
    }catch(e){out.innerHTML='<div class="zc-res no"><b>We couldn\'t find your ZIP code.</b><span>Type it in instead.</span></div>'}
  },()=>{out.innerHTML='<div class="zc-res no"><b>Location is turned off for this site.</b><span>Type your ZIP code instead.</span></div>'},{timeout:10000,maximumAge:600000});
}
function openZipModal(){
  $('#layer').innerHTML=`<div class="scrim" data-close></div><div class="modal"><div class="box zipbox" role="dialog" aria-label="Check your ZIP code"><button class="x zc-close" data-close aria-label="Close">×</button>${zipChecker()}</div></div>`;
  setTimeout(()=>$('#zip-in')?.focus(),50);
}

/* ---------- shop ---------- */
function filterLabel(){return shopFilter.type==='cat'?catName(shopFilter.val):shopFilter.type==='feat'?'Most liked':shopFilter.val||''}
function openFilters(){
  const on=(t,v)=>shopFilter.type===t&&(v==null||shopFilter.val===v)?'on':'';
  $('#layer').innerHTML=`<div class="scrim" data-close></div><aside class="drawer fsheet" role="dialog" aria-label="Filter and sort"><header><h2 style="font-size:30px">Filter &amp; Sort</h2><button class="x" data-close aria-label="Close">×</button></header>
   <div class="body">
    <label>Search<input id="shopq2" type="search" placeholder="Search menu" value="${esc(q)}"></label>
    <label>Sort by<select id="sort2"><option value="newest">Newest</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="name">Name A–Z</option></select></label>
    <div class="eyebrow" style="margin-top:6px">Category</div>
    <div class="fchips"><button class="${on('all')}" data-f="all">All</button><button class="${on('feat')}" data-f="feat">Most liked</button>${CATS.map(c=>`<button class="${on('cat',c.id)}" data-f="cat" data-v="${c.id}">${c.name}</button>`).join('')}</div>
    <div class="eyebrow" style="margin-top:6px">Filter</div>
    <div class="fchips">${tagsFor().map(t=>`<button class="${on('tag',t)}" data-f="tag" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
   </div><button class="btn" data-close style="margin-top:12px">Show results</button></aside>`;
  $('#sort2').value=sortBy;
}
function tagsFor(){const s=new Set();D.products.forEach(p=>p.tags.forEach(t=>s.add(t)));return[...s].sort()}
function vShop(V){
  let list=D.products.slice();
  if(shopFilter.type==='cat')list=list.filter(p=>p.cat===shopFilter.val);
  if(shopFilter.type==='tag')list=list.filter(p=>p.tags.includes(shopFilter.val));
  if(shopFilter.type==='feat')list=list.filter(p=>p.featured);
  if(q)list=list.filter(p=>(p.name+' '+p.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
  if(sortBy==='low')list.sort((a,b)=>a.price-b.price);
  if(sortBy==='high')list.sort((a,b)=>b.price-a.price);
  if(sortBy==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  const on=(t,v)=>shopFilter.type===t&&(v==null||shopFilter.val===v)?'on':'';
  V.innerHTML=`<div class="wrap shop">
   <aside class="side"><h3>Browse by</h3><ul>
    <li><button class="${on('all')}" data-f="all">All Products</button></li>
    <li><button class="${on('feat')}" data-f="feat">Most liked</button></li>
    ${CATS.map(c=>`<li><button class="${on('cat',c.id)}" data-f="cat" data-v="${c.id}">${c.name}</button></li>`).join('')}
    <li class="grp">Filter</li>
    ${tagsFor().map(t=>`<li><button class="${on('tag',t)}" data-f="tag" data-v="${esc(t)}">${esc(t)}</button></li>`).join('')}
   </ul></aside>
   <section>
    <div class="shophead"><span class="count">${list.length} products${shopFilter.type!=='all'?` · <b>${esc(filterLabel())}</b>`:''}</span>
     <button class="filterbtn" id="filterbtn" type="button">Filter &amp; Sort</button>
     <div class="row deskonly"><input id="shopq" type="search" placeholder="Search menu" value="${esc(q)}" aria-label="Search menu">
     <label class="row" style="color:var(--muted)">Sort by:<select id="sort"><option value="newest">Newest</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="name">Name A–Z</option></select></label></div></div>
    <div class="grid">${list.map(p=>`<div class="card"><button class="img" data-p="${p.id}" aria-label="${esc(p.name)} details">${p.featured?'<span class="tag">Hot</span>':''}${art(p)}</button><button class="nm" data-p="${p.id}">${esc(p.name)}</button><div class="pr ${p.stock<=0?'oos':''}">${p.stock<=0?'Out of stock':fromPrice(p)}${p.size?` <span>· ${esc(p.size)}</span>`:''}</div>
     ${p.stock>0&&choices(p)?`<div class="cardbuy"><button type="button" class="btn addbtn" data-p="${p.id}">Choose ${esc((p.options.name||'option').toLowerCase())}</button></div>`:p.stock>0?`<div class="cardbuy"><div class="cq"><button type="button" data-cq2="-1" aria-label="Less">−</button><span class="num">1</span><button type="button" data-cq2="1" data-max="${p.stock}" aria-label="More">+</button></div><button type="button" class="btn addbtn" data-quick="${p.id}">Add to cart</button></div>`:''}</div>`).join('')||'<p class="note">No products match. Try another category.</p>'}</div>
   </section></div>`;
  $('#sort').value=sortBy;
}
let selOpt=null,curP=null;
function openProduct(id){
  const p=prod(id);if(!p)return;curP=id;
  const ch=choices(p);selOpt=ch?(ch.find(c=>c.stock>0)||{}).label||null:null;
  $('#layer').innerHTML=`<div class="scrim" data-close></div><div class="modal"><div class="box" role="dialog" aria-label="${esc(p.name)}">
   <div class="pimg">${art(p)}</div>
   <div class="pinfo" id="pinfo"></div></div></div>`;
  drawProduct(p);
}
function drawProduct(p){
  const ch=choices(p),maxOff=Math.max(0,...D.tiers.map(t=>t.pct_off)),minOff=Math.min(...D.tiers.map(t=>t.pct_off));
  const price=ch&&selOpt?itemPrice(p,selOpt):Number(p.price),stock=ch?(selOpt?itemStock(p,selOpt):0):p.stock;
  $('#pinfo').innerHTML=`<div class="row" style="justify-content:space-between"><span class="eyebrow">${catName(p.cat)}</span><button class="x" data-close aria-label="Close">×</button></div>
    <h2>${esc(p.name)}</h2>
    <div class="chips">${[p.strain,p.thc,p.size,...(p.tags||[])].filter(Boolean).slice(0,4).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    ${ch?`<div class="optgrp"><div class="eyebrow">${esc(p.options.name||'Options')}</div><div class="opts">${ch.map(c=>`<button type="button" class="opt${c.label===selOpt?' on':''}" data-opt="${esc(c.label)}" ${c.stock>0?'':'disabled'}><span>${esc(c.label)}</span><small>${c.stock>0?money(c.price):'Sold out'}</small></button>`).join('')}</div></div>`:''}
    <div class="num" style="font-size:26px;font-weight:600">${money(price)}</div>
    ${D.tiers.length?`<div class="note">Members pay ${money(price*(1-minOff/100))}–${money(price*(1-maxOff/100))}</div>`:''}
    ${p.stock<=0||(ch&&!selOpt)?'<div class="warnbox">Out of stock. Check back soon.</div>':`<div class="row"><div class="qty"><button data-mq="-1" aria-label="Less">−</button><span class="num" id="mq">1</span><button data-mq="1" aria-label="More">+</button></div><button class="btn" data-add="${p.id}">Add to cart</button></div>${stock<=3?`<div class="note">Only ${stock} left</div>`:''}`}
    ${p.description?`<p class="pdesc">${esc(p.description)}</p>`:''}`;
}
function addToCart(id,qty,opt){const p=prod(id);opt=choices(p)?opt:undefined;const ex=cart.find(x=>x.id===id&&(x.opt||null)===(opt||null));const n=Math.min(itemStock(p,opt),(ex?ex.qty:0)+qty);if(n<=0)return toast('That option is sold out','',true);ex?ex.qty=n:cart.push(opt?{id,opt,qty:n}:{id,qty:n});saveCart();toast(`Added ${p.name}${opt?' · '+opt:''}`,'',true)}
const cartSub=()=>cart.reduce((s,x)=>{const p=prod(x.id);return s+(p?itemPrice(p,x.opt):0)*x.qty},0);
function openCart(){
  saveCart();const sub=cartSub(),base=Number(D.settings.base_min),low=sub<base;
  $('#layer').innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-label="Cart"><header><h2 style="font-size:30px">Your cart</h2><button class="x" data-close aria-label="Close">×</button></header>
   <div class="body">${cart.length?cart.map((x,i)=>{const p=prod(x.id);return`<div class="line"><div class="th">${art(p)}</div><div><div style="font-size:14px">${esc(p.name)}</div>${x.opt?`<div class="note">${esc(x.opt)}</div>`:''}<div class="note num">${money(itemPrice(p,x.opt))}</div></div><div class="qty"><button data-cq="${i}" data-d="-1" aria-label="Less">−</button><span class="num">${x.qty}</span><button data-cq="${i}" data-d="1" aria-label="More">+</button></div></div>`}).join(''):'<p class="note">Your cart is empty. Tap a category on the home page to start.</p>'}</div>
   ${cart.length?`<div class="totals"><div><span>Subtotal</span><span class="num">${money(sub)}</span></div>${low?`<div class="warnbox">Add ${money(base-sub)} more. We don't deliver orders under $${base}.</div>`:''}${!D.settings.open?'<div class="warnbox">We are closed right now.</div>':''}<button class="btn" data-go="checkout" ${low||!D.settings.open?'disabled':''}>Check out · cash on delivery</button></div>`:''}
  </aside>`;
}

/* ---------- checkout ---------- */
let co=store.get('c420co',{name:'',phone:'',address:'',city:'',notes:''});co.age=false;if(!co.city&&store.get('c420zip',null))co.city=store.get('c420zip',null).city;
let quote=null,placing=false;
async function refreshQuote(){
  const {data,error}=await sb.rpc('quote_order',{p_items:cart,p_city:co.city||null,p_phone:co.phone||null});
  quote=error?null:data;drawSummary();
}
function vCheckout(V){
  if(!cart.length){location.hash='#shop';return}
  V.innerHTML=`<div class="wrap page"><h1>Checkout</h1><p class="lede">Cash on delivery only. We'll call or text to confirm, then your driver sends an ETA.</p>
  <div class="checkout"><form class="form" id="cof" novalidate>
   <div class="two"><label>Full name<input id="co-name" required autocomplete="name" value="${esc(co.name)}"></label>
   <label>Mobile number<input id="co-phone" required inputmode="tel" autocomplete="tel" placeholder="(313) 555-0100" value="${esc(co.phone)}"></label></div>
   <label>Street address<input id="co-address" required autocomplete="street-address" value="${esc(co.address)}"></label>
   <label>City<select id="co-city" required><option value="">Choose your city</option>${allCities().map(c=>`<option ${c===co.city?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <label>Delivery notes (optional)<textarea id="co-notes" rows="2" maxlength="300" placeholder="Gate code, parking, best way to reach you">${esc(co.notes)}</textarea></label>
   <label class="check"><input type="checkbox" id="co-age"> <span>I'm 21 or older and will show a valid government ID to the driver. I'll meet the driver at their vehicle with cash ready.</span></label>
   <div id="co-err" class="warnbox" hidden></div>
   <button class="btn" type="submit" id="co-submit" style="justify-self:start;font-size:17px;padding:12px 24px">Place order</button>
   <p class="note">Missed deliveries carry a re-delivery fee of ${esc(D.settings.redeliver)}. Your city not listed? <a href="#areas">See our service area</a>.</p>
  </form>
  <aside class="summary" id="summary"><p class="note">Calculating…</p></aside></div></div>`;
  refreshQuote();
}
function drawSummary(){
  const el=$('#summary');if(!el)return;
  if(!quote){el.innerHTML='<p class="note">Couldn\'t load prices. Check your connection.</p>';return}
  const Q=quote;
  el.innerHTML=`<h2 style="font-size:26px">Order summary</h2>
   ${Q.lines.map(x=>`<div class="row" style="justify-content:space-between;font-size:14px"><span>${x.qty} × ${esc(x.name)}</span><span class="num">${money(x.price*x.qty)}</span></div>`).join('')}
   <div class="totals"><div><span>Subtotal</span><span class="num">${money(Q.subtotal)}</span></div>
   ${Q.tier?`<div style="color:var(--green)"><span>${esc(Q.tier_name)} member −${Q.pct_off}%</span><span class="num">−${money(Q.discount)}</span></div>`:''}
   <div><span>Delivery${Q.zone_min!=null?` ($${Number(Q.zone_min)} city minimum)`:''}</span><span class="num">${Q.fee?money(Q.fee):(Q.zone_min!=null?'Free':'Pick a city')}</span></div>
   <div class="grand"><span>Cash due at door</span><span class="num">${money(Q.total)}</span></div></div>
   ${Q.fee&&Q.zone_min!=null?`<p class="note">Add ${money(Q.zone_min-(Q.subtotal-Q.discount))} more to reach your city's $${Number(Q.zone_min)} minimum and skip the fee.</p>`:''}
   ${!Q.tier&&D.tiers.length?`<p class="note">Members save ${Math.min(...D.tiers.map(t=>t.pct_off))}–${Math.max(...D.tiers.map(t=>t.pct_off))}%. Enter the phone on your membership to apply it.</p>`:''}
   ${Q.errors.length?`<div class="warnbox">${esc(Q.errors[0])}</div>`:''}`;
  const b=$('#co-submit');if(b)b.textContent=`Place order · ${money(Q.total)} cash`;
}
function readCo(){co={name:$('#co-name').value.trim(),phone:$('#co-phone').value.trim(),address:$('#co-address').value.trim(),city:$('#co-city').value,notes:$('#co-notes').value.trim(),age:$('#co-age').checked};store.set('c420co',{...co,age:undefined})}
async function placeOrder(){
  if(placing)return;readCo();const e=$('#co-err');e.hidden=true;
  const miss=[];if(!co.name)miss.push('your name');if(co.phone.replace(/\D/g,'').length<10)miss.push('a 10-digit mobile number');if(!co.address)miss.push('your street address');if(!co.city)miss.push('your city');
  if(miss.length){e.hidden=false;e.textContent='Please add '+miss.join(', ')+'.';return}
  if(!co.age){e.hidden=false;e.textContent='Confirm you are 21+ and will show ID at delivery.';return}
  placing=true;const b=$('#co-submit');b.disabled=true;b.textContent='Placing order…';
  const {data,error}=await sb.rpc('place_order',{p_items:cart,p_name:co.name,p_phone:co.phone,p_address:co.address,p_city:co.city,p_notes:co.notes,p_age_ok:co.age});
  placing=false;
  if(error){e.hidden=false;e.textContent=errMsg(error);b.disabled=false;refreshQuote();return}
  store.set('c420last',{...data,name:co.name,phone:co.phone});cart=[];saveCart();
  loadAll().catch(()=>{});location.hash='#done';
}
function vDone(V){
  const o=store.get('c420last',null);if(!o){location.hash='#home';return}
  V.innerHTML=`<div class="wrap page"><span class="eyebrow">Order received</span><h1>Thanks, ${esc(o.name.split(' ')[0])}</h1>
  <p class="lede">Order <b class="mono">${esc(o.code)}</b> is in. We'll call or text ${esc(o.phone)} to confirm, then your driver will send an ETA.</p>
  <div class="summary" style="max-width:480px"><div class="totals"><div class="grand"><span>Have this cash ready</span><span class="num">${money(o.total)}</span></div></div>
  <p class="note" style="margin:0">Meet your driver at their vehicle with a valid 21+ ID. Exact change helps.</p></div>
  <p style="margin-top:22px"><a class="btn ghost" href="#shop" style="text-decoration:none">Back to the menu</a></p></div>`;
}

/* ---------- membership ---------- */
function vMembers(V){
  V.innerHTML=`<div class="wrap page"><span class="eyebrow">Private membership</span><h1>Join the club</h1>
  <p class="lede">Monthly membership, paid in cash with any delivery. Apply below. We review every application and confirm by phone, then your discount applies automatically at checkout.</p>
  <div class="tiers">${D.tiers.map((t,i)=>`<div class="tier ${i===1?'hot':''}"><span class="eyebrow">${i===1?'Most popular':'Tier '+(i+1)}</span><h3>${esc(t.name)}</h3><div class="price">$${Number(t.price)}<small> / month, cash</small></div><ul>${t.perks.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><button class="btn ${i===1?'':'ghost'}" data-tier="${t.id}">Apply for ${esc(t.name)}</button></div>`).join('')}</div>
  <form class="form" id="memf" novalidate><h2 style="font-size:30px">Membership application</h2>
   <div class="two"><label>Full name<input id="m-name" required autocomplete="name"></label><label>Mobile number<input id="m-phone" inputmode="tel" autocomplete="tel" required placeholder="(313) 555-0100"></label></div>
   <label>Tier<select id="m-tier">${D.tiers.map(t=>`<option value="${t.id}">${esc(t.name)} · $${Number(t.price)}/mo</option>`).join('')}</select></label>
   <label class="check"><input type="checkbox" id="m-age"> <span>I'm 21+ and understand dues are paid in cash to my driver each month.</span></label>
   <div id="m-err" class="warnbox" hidden></div>
   <button class="btn" type="submit" style="justify-self:start">Submit application</button></form></div>`;
}
async function applyMember(f){
  const name=$('#m-name').value.trim(),ph=$('#m-phone').value,err=$('#m-err');err.hidden=true;
  if(!name||ph.replace(/\D/g,'').length<10){err.hidden=false;err.textContent='Add your name and a 10-digit mobile number.';return}
  if(!$('#m-age').checked){err.hidden=false;err.textContent='Confirm you are 21+ and agree to monthly cash dues.';return}
  const {data,error}=await sb.rpc('apply_membership',{p_name:name,p_phone:ph,p_tier:$('#m-tier').value});
  if(error){err.hidden=false;err.textContent=errMsg(error);return}
  f.innerHTML=`<h2 style="font-size:30px">Application received</h2><p class="lede" style="margin:0">Thanks, ${esc(name.split(' ')[0])}. We'll call ${esc(data.phone)} to confirm. Your first month is collected in cash with your next delivery.</p>`;
}

/* ---------- events ---------- */
function vEvents(V){
  const mine=store.get('c420rsvp',{});
  V.innerHTML=`<div class="wrap page"><span class="eyebrow">21+ · ID at the door</span><h1>Events</h1><p class="lede">Tastings, drops and pop-ups around Metro Detroit. Member events need an active membership. Exact addresses go to people who RSVP.</p>
  <div class="events">${D.events.map(e=>{const d=new Date(e.starts_on+'T12:00');return`<article class="event"><div class="date"><span>${d.toLocaleDateString('en-US',{month:'short'}).toUpperCase()}</span><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</span></div>
   <div><div class="row">${e.members_only?'<span class="pill p-new">Members only</span>':'<span class="pill p-muted">Open to 21+</span>'}</div><h3 style="margin-top:6px">${esc(e.title)}</h3><p>${[e.time_label,e.place].filter(Boolean).map(esc).join(' · ')}</p>${e.description?`<p>${esc(e.description)}</p>`:''}</div>
   <button class="btn ${mine[e.id]?'green':''}" data-rsvp="${e.id}">${mine[e.id]?'Going ✓':'RSVP'}</button></article>`}).join('')||'<p class="note">No events on the calendar right now. Members hear about new drops and events first.</p>'}</div></div>`;
}
async function rsvp(id){
  const mine=store.get('c420rsvp',{});const going=!mine[id];
  const {error}=await sb.rpc('rsvp_event',{p_event:id,p_going:going});
  if(error){toast(errMsg(error),'',true);return}
  if(going)mine[id]=1;else delete mine[id];store.set('c420rsvp',mine);
  const ev=D.events.find(x=>x.id===id);if(going)toast(`You're on the list for ${ev.title}`,ev.members_only?'Bring your member ID and 21+ ID.':'Bring a valid 21+ ID.',true);
  vEvents($('#view'));
}

/* ---------- events wiring ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a,[data-close]');if(!t)return;
  if(t.matches('[data-close]')){$('#layer').innerHTML='';return}
  if(t.id==='cartbtn'){openCart();return}
  if(t.dataset.f){shopFilter={type:t.dataset.f,val:t.dataset.v||null};if(t.closest('.fsheet'))$('#layer').innerHTML='';if(route!=='shop')location.hash='#shop';else{vShop($('#view'));window.scrollTo(0,0)}return}
  if(t.id==='filterbtn'){openFilters();return}
  if(t.dataset.cq2){const box=t.closest('.cq'),sp=box.querySelector('span'),max=+box.querySelector('[data-max]').dataset.max;sp.textContent=Math.max(1,Math.min(max,+sp.textContent+ +t.dataset.cq2));return}
  if(t.dataset.quick){const n=+t.closest('.cardbuy').querySelector('.cq span').textContent;addToCart(t.dataset.quick,n);t.textContent='Added ✓';setTimeout(()=>{t.textContent='Add to cart'},1200);return}
  if(t.id==='jz-pickup'){$('#zip-out').innerHTML='<div class="zc-res no"><b>Pickup isn\'t available.</b><span>Cargo+420 is delivery only. Enter your ZIP code below.</span></div>';return}
  if(t.id==='menubtn'){const n=$('#nav'),o=!n.classList.contains('open');n.classList.toggle('open',o);t.setAttribute('aria-expanded',o);return}
  if(t.dataset.p){openProduct(t.dataset.p);return}
  if(t.dataset.mq){const el=$('#mq');el.textContent=Math.max(1,+el.textContent+ +t.dataset.mq);return}
  if(t.dataset.opt!==undefined){selOpt=t.dataset.opt;const p=prod(curP);if(p)drawProduct(p);return}
  if(t.dataset.add){addToCart(t.dataset.add,+$('#mq').textContent,selOpt);$('#layer').innerHTML='';return}
  if(t.dataset.cq!==undefined){const x=cart[+t.dataset.cq];if(!x)return;const p=prod(x.id);x.qty=Math.min(itemStock(p,x.opt),x.qty+ +t.dataset.d);saveCart();openCart();return}
  if(t.dataset.go){$('#layer').innerHTML='';location.hash='#'+t.dataset.go;return}
  if(t.dataset.tier){$('#m-tier').value=t.dataset.tier;$('#memf').scrollIntoView({behavior:'smooth'});$('#m-name').focus({preventScroll:true});return}
  if(t.dataset.rsvp){rsvp(t.dataset.rsvp);return}
  if(t.id==='zipchip'){openZipModal();return}
  if(t.id==='zip-loc'){useLocation();return}
  if(t.closest('.zc-res')&&t.matches('a[href="#shop"]')){$('#layer').innerHTML=''}
});
let qT;
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='sort'||t.id==='sort2'){sortBy=t.value;vShop($('#view'));return}
  if(t.id==='co-city'||t.id==='co-phone'){readCo();refreshQuote();return}
});
document.addEventListener('input',e=>{
  if(e.target.id==='shopq'){clearTimeout(qT);qT=setTimeout(()=>{q=e.target.value;vShop($('#view'));const i=$('#shopq');i.focus();i.setSelectionRange(q.length,q.length)},250)}
  if(e.target.id==='shopq2'){clearTimeout(qT);qT=setTimeout(()=>{q=e.target.value;vShop($('#view'))},250)}
});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='cof')placeOrder();if(e.target.id==='memf')applyMember(e.target);if(e.target.id==='zipf')checkZip($('#zip-in').value)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#layer').innerHTML=''});

/* ---------- age gate + boot ---------- */
const gate=$('#gate');gate.hidden=store.get('c420age',0)===1;
$('#gate-yes').onclick=()=>{store.set('c420age',1);gate.hidden=true};
$('#gate-no').onclick=()=>{$('#gate-msg').hidden=false};
loadAll().then(go).catch(err=>{$('#view').innerHTML=`<div class="wrap loading">We couldn't load the menu. Refresh the page to try again.<br><small>${esc(errMsg(err))}</small></div>`});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['shop','home'].includes(route))loadAll().then(render).catch(()=>{})});
