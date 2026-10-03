/* Cargo+420 storefront */
const ICONS={
 flower:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 42V24M24 24c0-9 0-14 0-20 4 6 5 13 0 20zM24 24c-5-6-11-9-18-9 3 7 10 10 18 9zM24 24c5-6 11-9 18-9-3 7-10 10-18 9zM24 26c-4 2-9 3-14 2 3 4 9 5 14-2zM24 26c4 2 9 3 14 2-3 4-9 5-14-2z"/></svg>',
 edibles:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="7" y="16" width="34" height="22" rx="4"/><path d="M7 24h34M18 16v22M30 16v22"/><path d="M15 10c2-3 6-3 8 0M27 10c2-3 6-3 8 0"/></svg>',
 cbd:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="15" y="18" width="18" height="24" rx="3"/><path d="M19 18v-5h10v5M22 13V6h4v7"/><path d="M20 30h8"/></svg>',
 concentrates:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><ellipse cx="24" cy="34" rx="16" ry="6"/><path d="M8 34V26c0-3 7-6 16-6s16 3 16 6v8"/><path d="M18 16c0-4 6-6 6-10 0 4 6 6 6 10a6 6 0 0 1-12 0z"/></svg>',
 mushrooms:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M6 24C6 14 14 7 24 7s18 7 18 17z"/><path d="M18 24v12a6 6 0 0 0 12 0V24"/><circle cx="16" cy="16" r="2"/><circle cx="29" cy="13" r="2"/></svg>',
 vapes:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="19" y="14" width="10" height="30" rx="3"/><path d="M21 14V6h6v8M19 26h10"/></svg>',
 enhance:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 40S7 30 7 18a8 8 0 0 1 17-4 8 8 0 0 1 17 4c0 12-17 22-17 22z"/></svg>',
 all:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="7" y="7" width="14" height="14"/><rect x="27" y="7" width="14" height="14"/><rect x="7" y="27" width="14" height="14"/><rect x="27" y="27" width="14" height="14"/></svg>'
};
const HOME_CATS=['flower','edibles','cbd','concentrates','mushrooms','vapes','enhance'];
const D={products:[],zones:[],settings:{},tiers:[],events:[]};
const prod=id=>D.products.find(p=>p.id===id);
const allCities=()=>D.zones.flatMap(z=>z.cities).sort((a,b)=>a.localeCompare(b));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let cart=store.get('c420cart',[]);
function saveCart(){cart=cart.filter(x=>prod(x.id)&&x.qty>0);store.set('c420cart',cart);$('#cartn').textContent=cart.reduce((s,x)=>s+x.qty,0)}

async function loadAll(){
  const [p,z,s,t,e]=await Promise.all([
    sb.from('products').select('*').eq('active',true).order('created_at',{ascending:false}),
    sb.from('zones').select('*').order('sort'),
    sb.from('store_settings').select('*').eq('id',1).single(),
    sb.from('tiers').select('*').order('sort'),
    sb.from('events').select('*').gte('starts_on',new Date(Date.now()-864e5).toISOString().slice(0,10)).order('starts_on')]);
  const err=[p,z,s,t,e].find(x=>x.error);if(err)throw err.error;
  D.products=p.data;D.zones=z.data;D.settings=s.data;D.tiers=t.data;D.events=e.data;
}

/* ---------- routing ---------- */
let route='home',shopFilter={type:'all',val:null},sortBy='newest',q='';
function go(){
  const h=(location.hash||'#home').slice(1);
  route=['home','shop','members','events','areas','checkout','done'].includes(h)?h:'home';
  if(CATS.some(c=>c.id===h)){route='shop';shopFilter={type:'cat',val:h}}
  render();window.scrollTo(0,0);
}
window.addEventListener('hashchange',go);
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
  <section class="hero"><img src="img/logo.webp" alt="Cargo+420 Exclusive Delivery Service"><p>Metro Detroit cannabis delivery. Pick a category, build your order, pay cash at the door.</p></section>
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
  V.innerHTML=`<div class="wrap page"><h1>Service area</h1>
  <p class="lede">We don't deliver orders under $${Number(D.settings.base_min)}. If your order is under your city's minimum, a delivery fee applies. Missed deliveries carry a re-delivery fee of ${esc(D.settings.redeliver)}.</p>
  <div class="zones">${D.zones.map(z=>`<div class="zone"><div class="min">$${Number(z.min_order)}<small>minimum${Number(z.fee)?` · $${Number(z.fee)} fee if under`:''}</small></div><p>${esc(z.cities.join(', '))}</p></div>`).join('')}</div></div>`;
}

/* ---------- shop ---------- */
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
    <div class="mobile-cats"><button class="${on('all')}" data-f="all">All</button>${CATS.map(c=>`<button class="${on('cat',c.id)}" data-f="cat" data-v="${c.id}">${c.name}</button>`).join('')}</div>
    <div class="shophead"><span class="count">${list.length} products</span>
     <div class="row"><input id="shopq" type="search" placeholder="Search menu" value="${esc(q)}" aria-label="Search menu">
     <label class="row" style="color:var(--muted)">Sort by:<select id="sort"><option value="newest">Newest</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="name">Name A–Z</option></select></label></div></div>
    <div class="grid">${list.map(p=>`<button class="card" data-p="${p.id}"><div class="img">${p.featured?'<span class="tag">Hot</span>':''}${art(p)}</div><div class="nm">${esc(p.name)}</div><div class="pr ${p.stock<=0?'oos':''}">${p.stock<=0?'Out of stock':money(p.price)}</div></button>`).join('')||'<p class="note">No products match. Try another category.</p>'}</div>
   </section></div>`;
  $('#sort').value=sortBy;
}
function openProduct(id){
  const p=prod(id);if(!p)return;
  const maxOff=Math.max(0,...D.tiers.map(t=>t.pct_off)),minOff=Math.min(...D.tiers.map(t=>t.pct_off));
  $('#layer').innerHTML=`<div class="scrim" data-close></div><div class="modal"><div class="box" role="dialog" aria-label="${esc(p.name)}">
   <div class="pimg">${art(p)}</div>
   <div class="pinfo"><div class="row" style="justify-content:space-between"><span class="eyebrow">${catName(p.cat)}</span><button class="x" data-close aria-label="Close">×</button></div>
    <h2>${esc(p.name)}</h2>
    <div class="chips">${[p.strain,p.thc,p.size].filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    <div class="num" style="font-size:26px;font-weight:600">${money(p.price)}</div>
    ${D.tiers.length?`<div class="note">Members pay ${money(p.price*(1-minOff/100))}–${money(p.price*(1-maxOff/100))}</div>`:''}
    ${p.description?`<p style="margin:0">${esc(p.description)}</p>`:''}
    ${p.stock<=0?'<div class="warnbox">Out of stock. Check back soon.</div>':`<div class="row"><div class="qty"><button data-mq="-1" aria-label="Less">−</button><span class="num" id="mq">1</span><button data-mq="1" aria-label="More">+</button></div><button class="btn" data-add="${p.id}">Add to cart</button></div>${p.stock<=3?`<div class="note">Only ${p.stock} left</div>`:''}`}
   </div></div></div>`;
}
function addToCart(id,qty){const p=prod(id);const ex=cart.find(x=>x.id===id);const n=Math.min(p.stock,(ex?ex.qty:0)+qty);ex?ex.qty=n:cart.push({id,qty:n});saveCart();toast(`Added ${p.name}`,'',true)}
const cartSub=()=>cart.reduce((s,x)=>s+(prod(x.id)?.price||0)*x.qty,0);
function openCart(){
  saveCart();const sub=cartSub(),base=Number(D.settings.base_min),low=sub<base;
  $('#layer').innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-label="Cart"><header><h2 style="font-size:30px">Your cart</h2><button class="x" data-close aria-label="Close">×</button></header>
   <div class="body">${cart.length?cart.map(x=>{const p=prod(x.id);return`<div class="line"><div class="th">${art(p)}</div><div><div style="font-size:14px">${esc(p.name)}</div><div class="note num">${money(p.price)}</div></div><div class="qty"><button data-cq="${x.id}" data-d="-1" aria-label="Less">−</button><span class="num">${x.qty}</span><button data-cq="${x.id}" data-d="1" aria-label="More">+</button></div></div>`}).join(''):'<p class="note">Your cart is empty. Tap a category on the home page to start.</p>'}</div>
   ${cart.length?`<div class="totals"><div><span>Subtotal</span><span class="num">${money(sub)}</span></div>${low?`<div class="warnbox">Add ${money(base-sub)} more. We don't deliver orders under $${base}.</div>`:''}${!D.settings.open?'<div class="warnbox">We are closed right now.</div>':''}<button class="btn" data-go="checkout" ${low||!D.settings.open?'disabled':''}>Check out · cash on delivery</button></div>`:''}
  </aside>`;
}

/* ---------- checkout ---------- */
let co=store.get('c420co',{name:'',phone:'',address:'',city:'',notes:''});co.age=false;
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
  if(t.dataset.f){shopFilter={type:t.dataset.f,val:t.dataset.v||null};vShop($('#view'));return}
  if(t.dataset.p){openProduct(t.dataset.p);return}
  if(t.dataset.mq){const el=$('#mq');el.textContent=Math.max(1,+el.textContent+ +t.dataset.mq);return}
  if(t.dataset.add){addToCart(t.dataset.add,+$('#mq').textContent);$('#layer').innerHTML='';return}
  if(t.dataset.cq){const x=cart.find(c=>c.id===t.dataset.cq);const p=prod(x.id);x.qty=Math.min(p.stock,x.qty+ +t.dataset.d);saveCart();openCart();return}
  if(t.dataset.go){$('#layer').innerHTML='';location.hash='#'+t.dataset.go;return}
  if(t.dataset.tier){$('#m-tier').value=t.dataset.tier;$('#memf').scrollIntoView({behavior:'smooth'});$('#m-name').focus({preventScroll:true});return}
  if(t.dataset.rsvp){rsvp(t.dataset.rsvp);return}
});
let qT;
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='sort'){sortBy=t.value;vShop($('#view'));return}
  if(t.id==='co-city'||t.id==='co-phone'){readCo();refreshQuote();return}
});
document.addEventListener('input',e=>{
  if(e.target.id==='shopq'){clearTimeout(qT);qT=setTimeout(()=>{q=e.target.value;vShop($('#view'));const i=$('#shopq');i.focus();i.setSelectionRange(q.length,q.length)},250)}
});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='cof')placeOrder();if(e.target.id==='memf')applyMember(e.target)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#layer').innerHTML=''});

/* ---------- age gate + boot ---------- */
const gate=$('#gate');gate.hidden=store.get('c420age',0)===1;
$('#gate-yes').onclick=()=>{store.set('c420age',1);gate.hidden=true};
$('#gate-no').onclick=()=>{$('#gate-msg').hidden=false};
loadAll().then(go).catch(err=>{$('#view').innerHTML=`<div class="wrap loading">We couldn't load the menu. Refresh the page to try again.<br><small>${esc(errMsg(err))}</small></div>`});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['shop','home'].includes(route))loadAll().then(render).catch(()=>{})});
