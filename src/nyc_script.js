const SRC = __NYC__;
const PULLED = SRC.pulled, SINCE = SRC.since;
const NOW = new Date(), TODAY = Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const gsearch = q => "https://www.google.com/search?q="+encodeURIComponent(q);
const TRADES = {
  gc:{n:'GC / framing',s:.22,need:'general contracting, framing and carpentry'},
  concrete:{n:'Concrete',s:.08,need:'footings, foundation walls, slabs and site concrete'},
  site:{n:'Site work',s:.07,need:'demolition, excavation, support of excavation and utilities'},
  hvac:{n:'HVAC',s:.10,need:'heating, cooling and ventilation'},
  elec:{n:'Electrical',s:.09,need:'service, distribution, lighting and low voltage'},
  plumb:{n:'Plumbing',s:.07,need:'domestic water, sanitary, gas, sprinklers and fixtures'},
  roof:{n:'Roofing',s:.03,need:'roofing, flashing and waterproofing'},
  windows:{n:'Windows & doors',s:.05,need:'windows, storefront and exterior doors'},
  paint:{n:'Painting',s:.03,need:'interior and exterior painting, coatings and wall finishes'}
};
const tname = k => { const n=TRADES[k].n; return /^(GC|HVAC)/.test(n)?n:n.toLowerCase(); };
const BOROS = ['Manhattan','Brooklyn','Queens','Bronx','Staten Island'];
const WINDOWS = [7,14,30,60,90,180];
const A = {psf:500, trade:'concrete', days:30, boro:'', stage:'open'};
try{const s=JSON.parse(localStorage.getItem('nyc-assume')||'null'); if(s){A.psf=s.psf||A.psf; if(TRADES[s.trade])A.trade=s.trade; if(WINDOWS.includes(s.days))A.days=s.days; if(BOROS.includes(s.boro))A.boro=s.boro; if(['open','pre','permit'].includes(s.stage))A.stage=s.stage;}}catch(e){}
const PUBLIC = /NYC Agency|NYCHA|School Construction|Government|HPD/;
const fmt$ = v => v>=1e9? '$'+(v/1e9).toFixed(2)+'B' : v>=1e6? '$'+(v/1e6).toFixed(1)+'M' : v>=1e3? '$'+Math.round(v/1e3)+'K' : '$'+Math.round(v);
const fmtN = v => Math.round(v).toLocaleString('en-US');
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fdate = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-').map(Number); return d+' '+MON[m-1]+' '+y; };
const daysAgo = iso => { const [y,m,d]=iso.split('-').map(Number); return Math.max(0,Math.round((TODAY-Date.UTC(y,m-1,d))/864e5)); };
const STAGES = ['Filed','In plan review','Approved','Permit issued','Signed off'];
function stageOf(status, permitDate, gc){
  if(/Withdrawn|Revoke|Denied/i.test(status)) return -1;
  if(/LOC Issued|CO Issued/i.test(status)) return 4;
  if(/^Permit/i.test(status) || permitDate || gc) return 3;
  if(/^Approved/i.test(status)) return 2;
  if(/Review|Objections|Energy|QA|On ?Hold/i.test(status)) return 1;
  return 0;
}
const KINDS = {
  'New Building':{k:'new',t:'New building',w:25},
  'ALT-CO - New Building with Existing Elements to Remain':{k:'new',t:'New building, parts remain',w:22},
  'Alteration CO':{k:'reno',t:'Major alteration (new C of O)',w:15},
  'Alteration':{k:'amend',t:'Alteration',w:10}
};
const FL = ['foundation','structural','earth','soe','mech','boiler','sprinkler','plumbing','standpipe','solar','greenroof','demo','gcwork'];

const jobs = SRC.rows.map(r=>{
  const [id,status,house,street,boro,jobType,cost,sqfa,bldg,stories,units,exUnits,date,statusDate,approved,permitDate,ownerBiz,owner,ownerType,appTitle,applicant,appBiz,appAddr,rep,desc,nta,lat,lng,bin,bbl,zip,flags,gc]=r;
  const f={}; FL.forEach((k,i)=>f[k]=flags[i]==='1');
  return {id,status,addr:(house+' '+street).trim(),boro,jobType,cost,sqfa,bldg,stories,units,exUnits,date,statusDate,approved,permitDate,ownerBiz,owner,ownerType,appTitle,applicant,appBiz,appAddr,rep,desc,nta,lat,lng,bin,bbl,zip,f,gc:gc||null,
    kind:KINDS[jobType]||KINDS.Alteration, stage:stageOf(status,permitDate,gc)};
}).map(j=>{
  // A plain alteration reports the whole building's units and stories, not the work's, so only count units a job adds.
  j.whole = j.kind.k!=='amend';
  j.newUnits = j.kind.k==='new' ? j.units : j.whole ? Math.max(0,j.units-j.exUnits) : 0;
  return j;
});
const byId = new Map(jobs.map(j=>[j.id,j]));

function tradeValue(j,k){ const T=TRADES[k]; return j.value*T.s; }
function compute(){
  jobs.forEach(j=>{
    j.age = daysAgo(j.date);
    j.fromCost = j.cost>0;
    j.value = j.fromCost ? j.cost : j.sqfa*A.psf;
    j.tv = tradeValue(j,A.trade);
    j.c1 = !PUBLIC.test(j.ownerType) && j.stage>=0;
    j.c2 = j.c1 && (j.sqfa>=5000 || j.newUnits>=5 || j.cost>=SRC.altMinCost);
    j.c3 = j.c2 && j.sqfa<=250000 && j.cost<=50e6;
    j.inWin = j.age<=A.days;
    j.c4 = j.c3 && j.inWin && j.stage<4 && (!A.boro||j.boro===A.boro) && (A.stage==='open' || (A.stage==='pre'?j.stage<3:j.stage===3));
    j.score = j.c4 ? Math.round(Math.max(0,35-j.age/A.days*35) + Math.min(35,Math.max(0,(Math.log10(Math.max(j.value,1e5))-5.5)*14)) + j.kind.w + (j.newUnits>0?5:0)) : 0;
  });
}
function ago(j){return j.age===0?'today':j.age===1?'yesterday':j.age+' days ago'}
function newPill(j){return j.age<=14?'<span class="pill p-go" style="margin-left:6px">NEW</span>':''}
function kindPill(j){return `<span class="pill p-${j.kind.k==='new'?'go':j.kind.k==='reno'?'rev':'wait'}">${esc(j.kind.t)}</span>`}
function stagePill(j){return j.stage<0?'<span class="pill p-obj">Withdrawn</span>':`<span class="pill p-${j.stage>=3?'rev':'wait'}">${STAGES[j.stage]}</span>`}
function gcPill(j){return j.gc?'<span class="pill p-rev" style="margin-left:6px">GC ON PERMIT</span>':''}
const ownerName = j => j.ownerBiz || j.owner || 'Owner not stated';
const proTitle = j => j.appTitle==='RA'?'Architect':j.appTitle==='PE'?'Engineer':j.appTitle==='LA'?'Landscape architect':'Applicant';
const bisLink = j => j.bin?'https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin='+encodeURIComponent(j.bin):'';
const zolaLink = j => /^\d{10}$/.test(j.bbl)?`https://zola.planning.nyc.gov/l/lot/${+j.bbl[0]}/${+j.bbl.slice(1,6)}/${+j.bbl.slice(6)}`:'';
const DOBNOW = 'https://a810-dobnow.nyc.gov/publish/Index.html#!/';
function linksOf(j){
  const L=[{t:'DOB NOW public portal',s:'Search job number '+j.id+' for the filing, documents and status',u:DOBNOW,hot:1}];
  if(bisLink(j)) L.push({t:'DOB building profile',s:'Every job, permit, complaint and violation at this address (BIN '+j.bin+')',u:bisLink(j)});
  if(zolaLink(j)) L.push({t:'Zoning and lot map (ZoLa)',s:'Zoning district, lot size and ownership for BBL '+j.bbl,u:zolaLink(j)});
  L.push({t:'Look up the owner',s:'Search for '+ownerName(j)+' and this address',u:gsearch('"'+ownerName(j)+'" '+j.addr+' '+j.boro+' NY')});
  return L;
}
function sheetRow(j){return [j.date,j.id,j.addr,j.boro,j.nta,j.kind.t,j.status,j.sqfa||'',j.units||'',j.stories||'',Math.round(j.value),j.fromCost?'filed cost':'floor area estimate',j.ownerBiz,j.owner,j.ownerType,proTitle(j),j.applicant,j.appBiz,j.appAddr,j.rep,j.gc?j.gc[0]:'',j.desc,bisLink(j)].map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')}
function sheet(list){return ['Filed,DOB job,Address,Borough,Neighborhood,Type,DOB status,Sq ft,Units,Stories,Est. value,Value source,Owner business,Owner contact,Owner type,Design pro,Design pro name,Design firm,Design firm address,Filing rep,Contractor on permit,Description,DOB profile'].concat(list.map(sheetRow)).join('\n')}

const KEYS={
  gc:/(\bstor(y|ies)\b|\bunits?\b|construct|build|erect|addition|enlarg|renovat|demoli|partition|elevator|convert)/i,
  concrete:/(foundation|slab|concrete|garage|cellar|basement|retaining|\bwalls?\b|underpin|sidewalk|curb|footing|masonry)/i,
  site:/(excavat|demoli|underpin|shoring|site|sewer|utilit|drain|curb|yard|grad(e|ing))/i,
  hvac:/(hvac|heat|cool|mechanical|ventilat|boiler|\bac\b|air condition|duct|exhaust|rtu|vrf)/i,
  elec:/(electric|solar|\bev\b|lighting|generator|battery|elevator|fire alarm|energy)/i,
  plumb:/(plumb|bath|kitchen|laundry|sprinkler|\bwater\b|sewer|\bgas\b|fixture|standpipe|restaurant)/i,
  roof:/(\broofs?\b|rooftop|solar|terrace|bulkhead|parapet|waterproof)/i,
  windows:/(window|storefront|fa[cç]ade|glass|glazing|\bdoors?\b|curtain wall)/i,
  paint:/(fa[cç]ade|finish|interior|renovat|exterior|partition|ceiling|gut)/i
};
function sentences(t){return (t.match(/[^.!?]+(?:\.\d+[^.!?]*)*[.!?]*(\s|$)/g)||[]).map(x=>x.trim()).filter(x=>x.length>12)}
function evidence(j,k){const re=KEYS[k];return sentences(j.desc).filter(x=>re.test(x)).slice(0,3)}
const TYPICAL=/(usually|likely|typical|common|est\.|often|Low voltage|New drywall|Kitchen and bath exhaust|Flat membrane|plan for)/;

function tradeNeeds(j){
  const d=j.desc.toLowerCase(), has=re=>re.test(d), n=fmtN, f=j.f;
  const st=Math.max(1,j.stories||1), foot=j.sqfa?Math.round(j.sqfa/st):0;
  const isNew=j.kind.k==='new', house=/Family/.test(j.bldg)&&j.units<=3, multi=j.whole&&j.units>=4, tall=j.whole&&st>=4&&!house;
  const what=house?`a ${st}-story ${j.bldg.toLowerCase()} house`:j.units>=4?`a ${st}-story, ${j.units}-unit building`:`a ${st}-story building`;
  const size=j.sqfa?`${n(j.sqfa)} sq ft`:'size not stated';
  const out={};
  out.gc=[ isNew?`Ground-up build of ${what}${j.sqfa?', about '+n(j.sqfa)+' sq ft':''}.`:`${j.kind.t} in ${what} (${size} of work area): demo, partitions, finishes, code upgrades.`,
    j.gc?`${j.gc[0]} already holds the ${j.gc[2].toLowerCase()} permit (issued ${fdate(j.gc[3])}).`:'No contractor is on a DOB permit for this job yet.',
    tall?'4+ stories usually means an elevator, sprinklers and a fire-rated stair core.':null,
    j.whole&&j.exUnits&&j.units!==j.exUnits?`Dwelling units change from ${j.exUnits} to ${j.units}.`:null ];
  out.concrete=[ isNew?(foot?`Footings and foundation under a footprint of roughly ${n(foot)} sq ft (floor area ÷ stories).`:'Footings and slab; footprint not stated.'):(f.foundation?'Foundation work is part of this filing.':'Alteration: plan for limited concrete, mostly openings, pads and slab patching.'),
    f.foundation&&isNew?'Foundation work is checked on the filing.':null,
    f.structural?'Structural work is checked on the filing.':null,
    st>=7&&isNew?`${st} stories: likely a concrete frame or podium, plus elevator pit and stair cores.`:null,
    has(/underpin/)?'Underpinning of neighbors is mentioned in the description.':null,
    isNew?'New sidewalk, curb and vault work at the street (DOT builders pavement plan).':null ];
  out.site=[ f.earth?'Earth work (excavation) is checked on the filing.':isNew?'Excavation for the new foundation; earth work is filed separately.':'Little or no excavation expected for an alteration.',
    f.soe?'Support of excavation is checked on the filing: sheeting, shoring or underpinning.':null,
    f.demo||has(/demoli/)?'Demolition is part of the job.':null,
    isNew?'New water, sewer and gas or electric service connections to the street.':null ];
  out.hvac=[ multi?`${j.units} apartments: usually one heating/cooling system per unit (heat pumps or VRF), plus corridors and common areas.`:house?'Whole-house heating, cooling and ventilation.':`Heating and cooling for ${j.sqfa?n(j.sqfa)+' sq ft of ':''}space.`,
    f.mech?'Mechanical systems work is checked on the filing.':null,
    f.boiler?'Boiler equipment work is checked on the filing.':null,
    isNew?'New buildings must meet the NYC energy code and, for most, the all-electric law (Local Law 154), so plan for electric heat.':null,
    multi?'Kitchen and bath exhaust for every unit.':null ];
  out.elec=[ multi?`New service with ${j.units} unit meters plus a house panel.`:house?'Residential service, likely 200A or more.':`Service and distribution for ${j.sqfa?n(j.sqfa)+' sq ft':'the space'}.`,
    tall?'Elevator power, fire alarm and emergency lighting.':null,
    f.solar||has(/solar/)?'Solar is part of the filing.':null,
    'Low voltage: intercom, access control, data.' ];
  out.plumb=[ multi?`${j.units} kitchens and roughly ${Math.round(j.units*1.3)} bathrooms (est.), plus laundry.`:house?'Full house plumbing: kitchen, baths, laundry, gas or electric appliances.':'Restrooms and fixtures for the space.',
    f.plumbing?'Plumbing work is checked on the filing.':null,
    f.sprinkler?'Sprinkler work is checked on the filing.':(multi||tall?'A sprinkler system is likely required at this size.':null),
    f.standpipe?'Standpipe work is checked on the filing.':null ];
  out.roof=[ isNew?(foot?`Roughly ${n(foot)} sq ft of roof (about the footprint).`:'Roof area not stated.'):(has(/roof/)?'Roof work is mentioned in the description.':'No roof work stated; plan for patching at new penetrations.'),
    house?null:'Flat membrane roof with mechanical curbs is typical for this building type.',
    f.greenroof?'A green roof is checked on the filing.':null,
    f.solar?'Coordinate with the solar installation.':null,
    isNew&&st>=3?'New roofs over 3 stories usually need a sustainable roofing zone (solar or green roof).':null ];
  out.windows=[ multi?`Windows for ${j.units} apartments across ${st} floors (often 5 to 8 openings per unit).`:house?'Full window and exterior door package.':(has(/window|storefront|fa[cç]ade/)?'Window, storefront or facade work is mentioned in the description.':'Interior doors and frames; exterior openings not stated.'),
    has(/storefront|retail|commercial|store/)?'Storefront glazing at street level.':null ];
  out.paint=[ j.sqfa?`Roughly ${n(Math.round(j.sqfa*3/1000)*1000)} sq ft of walls and ceilings to paint (about 3× the ${n(j.sqfa)} sq ft floor area).`:'Interior walls and ceilings; floor area not stated.',
    multi?`${j.units} apartment interiors plus corridors, stairwells and lobby.`:null,
    isNew?'New drywall: prime, two finish coats, and touch-up at turnover.':'Alteration: patch, prep and repaint after demo and new partitions.' ];
  for(const k in out) out[k]=out[k].filter(Boolean);
  return out;
}

function emailOwner(j){
  const T=TRADES[A.trade], first=(j.owner||'').split(' ')[0]||'there';
  const scope=[j.sqfa?`${fmtN(j.sqfa)} sq ft`:'', j.newUnits?`${j.newUnits} ${j.kind.k==='new'?'':'new '}units`:'', j.whole&&j.stories?`${j.stories} stories`:''].filter(Boolean).join(', ');
  return `Subject: ${j.addr}, ${j.boro}: ${tname(A.trade)} pricing

Hi ${first},

I saw your ${j.kind.t.toLowerCase()} filing at ${j.addr} (DOB job ${j.id}${scope?', '+scope:''}). Congratulations on getting it into the Department of Buildings.

From the filing, the ${tname(A.trade)} side looks like: ${tradeNeeds(j)[A.trade].slice(0,2).map(x=>x.replace(/\.$/,'')).join('; ').replace(/^./,c=>c.toLowerCase())}.

We do ${T.need} on projects like this across the five boroughs, including [two local jobs]. By our rough math the ${tname(A.trade)} package here is in the ${fmt$(j.tv*0.8)} to ${fmt$(j.tv*1.2)} range. We'd be glad to give you early pricing while the plans are ${j.stage<2?'still in review':'being finalized'}.

${j.gc?`I see ${j.gc[0]} is on the permit. If they are buying out the trades, I'm happy to send our number to them directly.`:'Can we get on the bid list?'} I'll call [Thursday] in case that's easier.

[Your name]
[Company] · [Phone]`;
}
function emailPro(j){
  const toGC=!!j.gc, who=toGC?j.gc[1]:j.applicant, first=(who||'').split(' ')[0]||'there';
  return `Subject: ${j.addr}, ${j.boro}: ${tname(A.trade)} sub

Hi ${first},

${toGC?`I saw ${j.gc[0]} pulled the ${j.gc[2].toLowerCase()} permit at ${j.addr} (DOB job ${j.id}).`:`I saw your filing for ${ownerName(j)} at ${j.addr} (DOB job ${j.id}).`} We're a [${tname(A.trade)}] contractor working across the five boroughs.

${toGC?`Are you still taking ${tname(A.trade)} numbers on this one? We can turn a price around in [3 days] from the drawings.`:`When the owner is ready to price ${tname(A.trade)}, could you pass along our name, or tell me who is running the bid? We can also give budget pricing now if it helps the design.`}

Thanks,
[Your name]
[Company] · [Phone]`;
}

const $ = s=>document.querySelector(s);
function save(){try{localStorage.setItem('nyc-assume',JSON.stringify(A))}catch(e){}}
function tradebar(){
  $('#tradebar').innerHTML='<span class="lbl">Selling as</span>'+Object.entries(TRADES).map(([k,t])=>`<button class="tbtn ${k===A.trade?'on':''}" data-k="${k}" aria-pressed="${k===A.trade}">${t.n}</button>`).join('');
  document.querySelectorAll('#tradebar .tbtn').forEach(b=>b.onclick=()=>{A.trade=b.dataset.k;save();tradebar();refresh()});
}
function borobar(){
  $('#borobar').innerHTML='<span class="lbl">Borough</span>'+[''].concat(BOROS).map(b=>`<button class="tbtn ${b===A.boro?'on':''}" data-b="${b}" aria-pressed="${b===A.boro}">${b||'All five'}</button>`).join('');
  document.querySelectorAll('#borobar .tbtn').forEach(b=>b.onclick=()=>{A.boro=b.dataset.b;save();borobar();refresh()});
}
const callJobs = () => jobs.filter(j=>j.c4);
const stageLabel = () => A.stage==='pre'?'before a permit':A.stage==='permit'?'with a permit issued':'still open';
function ticker(){
  const stale=daysAgo(PULLED);
  $('#ticker').innerHTML=`Pulled ${fdate(PULLED)}${stale>3?` <b style="color:var(--bad)">(${stale} days old: run pull_nyc.py)</b>`:''} · <b>${fmtN(jobs.length)}</b> DOB filings read · <b>${callJobs().length}</b> on the call list (${A.boro||'all boroughs'}, last ${A.days} days) · $${A.psf}/sq ft where no cost is filed · ${TRADES[A.trade].n} at ${Math.round(TRADES[A.trade].s*100)}% of cost`;
}
const sum=(l,k)=>l.reduce((a,j)=>a+j[k],0);
function home(){
  const scope=jobs.filter(j=>(!A.boro||j.boro===A.boro)&&j.inWin);
  const c=callJobs(), T=TRADES[A.trade];
  $('#h-eyebrow').textContent=`${A.boro||'New York City, five boroughs'} · DOB NOW job filings · last ${A.days} days · pulled ${fdate(PULLED)}`;
  $('#h-big').textContent=fmt$(sum(c,'value'));
  const noGC=c.filter(j=>!j.gc);
  $('#h-lede').innerHTML=`<b>${fmtN(scope.length)}</b> new buildings and major alterations were filed with the Department of Buildings in ${esc(A.boro||'the five boroughs')} in the last ${A.days} days. <b>${c.length}</b> are private, local-builder size and ${stageLabel()}. That's about <b>${fmt$(sum(c,'tv'))}</b> of ${esc(tname(A.trade))} work, and <b>${noGC.length}</b> of them have no contractor on a permit yet.`;
  const s1=scope.filter(j=>j.c1),s2=scope.filter(j=>j.c2),s3=scope.filter(j=>j.c3);
  const steps=[['Filed',`Initial DOB filings, last ${A.days} days`,scope],['Cut 1','Private owner, not withdrawn',s1],['Cut 2',`A real job: 5,000+ sq ft, 5+ units or ${fmt$(SRC.altMinCost)}+ filed cost`,s2],['Cut 3','Local-builder size: under 250,000 sq ft and $50M',s3],['Call list',A.stage==='open'?'Not yet signed off':A.stage==='pre'?'No permit issued yet':'Permit issued',c]];
  $('#funnel').innerHTML=`<div class="pad" style="padding-bottom:4px"><div class="eyebrow">The bid schedule</div><h3 style="margin:4px 0 8px">From every filing to the first call</h3></div>`+
    steps.map((s,i)=>`<div class="step ${i>=4?'hot':''}"><div class="k">${s[0]}</div><div class="n">${fmtN(s[2].length)}</div><div class="t">${s[1]}</div><div class="m">${fmt$(sum(s[2],'value'))} est. value · ${fmt$(sum(s[2],'tv'))} ${esc(tname(A.trade))}<div class="bar"><span style="width:${(scope.length?s[2].length/scope.length*100:0).toFixed(1)}%"></span></div></div></div>`).join('');
  const hoods={};c.forEach(j=>{const k=j.nta||j.boro;hoods[k]=(hoods[k]||0)+1});
  const topH=Object.entries(hoods).sort((a,b)=>b[1]-a[1])[0];
  $('#tiles').innerHTML=[
    ['New buildings',c.filter(j=>j.kind.k==='new').length,'ground-up projects on the call list'],
    ['New housing units',fmtN(sum(c,'newUnits')),'apartments and homes added by call-list jobs'],
    ['No contractor yet',noGC.length,'call-list jobs with no GC on a DOB permit'],
    ['Busiest neighborhood',topH?topH[1]:0,topH?esc(topH[0])+' jobs on the list':'']
  ].map(t=>`<div class="panel tile"><div class="eyebrow">${t[0]}</div><div class="v">${t[1]}</div><div class="s">${t[2]}</div></div>`).join('');
  const top=c.slice().sort((a,b)=>b.score-a.score).slice(0,8);
  $('#top5').innerHTML=head(true)+top.map((j,i)=>row(j,i+1)).join('');
  bind('#top5'); drawMap();
}
function head(rank){return `<thead><tr>${rank?'<th>#</th>':''}<th>Filed</th><th>Project</th><th>Type and stage</th><th class="num">Sq ft</th><th class="num">New units</th><th class="num">Est. ${esc(tname(A.trade))}</th><th class="num">Score</th></tr></thead>`}
function row(j,rank){
  return `<tr class="row" data-id="${esc(j.id)}">${rank!==undefined?`<td class="rank">${rank}</td>`:''}<td class="num" style="text-align:left;white-space:nowrap">${fdate(j.date)}<div class="sub">${ago(j)}</div></td><td><div class="addr">${esc(j.addr)}${newPill(j)}${gcPill(j)}</div><div class="sub">${esc(j.nta?j.nta+', ':'')}${esc(j.boro)} · ${esc(ownerName(j))}</div><div class="sub" style="max-width:52ch;margin-top:2px">${esc(j.desc.length>150?j.desc.slice(0,150).replace(/\s+\S*$/,'')+'…':j.desc)}</div></td><td>${kindPill(j)}<div style="margin-top:4px">${stagePill(j)}</div></td><td class="num">${j.sqfa?fmtN(j.sqfa):'·'}</td><td class="num">${j.newUnits||'·'}</td><td class="num">${fmt$(j.tv)}</td><td class="num">${j.score||'·'}</td></tr>`;
}
function bind(sel){document.querySelectorAll(sel+' tr.row').forEach(tr=>tr.onclick=()=>{location.hash='job-'+tr.dataset.id})}
function assumeControls(){
  $('#assume1').innerHTML=`<div class="ctl"><label for="a-days">Filed within</label><select id="a-days">${WINDOWS.map(d=>`<option value="${d}" ${d===A.days?'selected':''}>Last ${d} days</option>`).join('')}</select></div>
  <div class="ctl"><label for="a-stage">Stage</label><select id="a-stage"><option value="open">Any open job</option><option value="pre">Before a permit (earliest)</option><option value="permit">Permit issued (GC named)</option></select></div>
  <div class="ctl"><label for="a-psf">Cost per sq ft (new buildings)</label><input type="range" id="a-psf" min="250" max="1000" step="25" value="${A.psf}"><output id="o-psf">$${A.psf}</output></div>
  <button class="btn ghost" id="sheetbtn" style="margin-left:auto">Copy contact sheet (CSV)</button>`;
  $('#a-stage').value=A.stage;
  $('#sheetbtn').onclick=async()=>{const c=callJobs().sort((a,b)=>b.score-a.score);try{await navigator.clipboard.writeText(sheet(c));$('#sheetbtn').textContent='Copied '+c.length+' rows'}catch(e){$('#sheetbtn').textContent='Copy blocked by browser'}};
  $('#a-days').onchange=e=>{A.days=+e.target.value;save();refresh()};
  $('#a-stage').onchange=e=>{A.stage=e.target.value;save();refresh()};
  $('#a-psf').oninput=e=>{A.psf=+e.target.value;$('#o-psf').textContent='$'+A.psf;save();refresh()};
}
const PAGE=150;
let callShown=PAGE, allShown=PAGE;
function more(id,shown,total,fn){return total>shown?`<div class="pad" style="text-align:center"><button class="btn ghost" id="${id}">Show ${Math.min(PAGE,total-shown)} more (${fmtN(total-shown)} hidden)</button></div>`:''}
function callList(){
  const c=callJobs().sort((a,b)=>b.score-a.score);
  $('#call-count').textContent=`${c.length} projects · ${fmt$(sum(c,'tv'))} of ${tname(A.trade)} work · sorted by score`;
  $('#calltable').innerHTML=head(true)+'<tbody>'+c.slice(0,callShown).map((j,i)=>row(j,i+1)).join('')+'</tbody>';
  $('#callmore').innerHTML=more('callmorebtn',callShown,c.length);
  if($('#callmorebtn')) $('#callmorebtn').onclick=()=>{callShown+=PAGE;callList()};
  bind('#calltable');
}
let sortK='age',sortDir=1;
const sortVal={kind:j=>j.kind.t+j.stage,name:j=>j.addr};
function allJobs(){
  const q=$('#f-q').value.toLowerCase(),b=$('#f-b').value,s=$('#f-s').value,st=$('#f-st').value,c=$('#f-c').value;
  let list=jobs.filter(j=>(!b||j.boro===b)&&(!s||j.jobType===s)&&(st===''||j.stage===+st)&&(!c||j.c4)&&(!q||(j.addr+' '+j.id+' '+j.nta+' '+j.ownerBiz+' '+j.owner+' '+j.appBiz+' '+j.applicant+' '+(j.gc?j.gc[0]:'')+' '+j.desc).toLowerCase().includes(q)));
  const val=sortVal[sortK]||(j=>j[sortK]);
  list.sort((x,y)=>{const a=val(x),bb=val(y);return (a>bb?1:a<bb?-1:0)*sortDir});
  $('#f-count').textContent=fmtN(list.length)+' filings';
  const cols=[['age','Filed'],['name','Project'],['kind','Type and stage'],['sqfa','Sq ft','num'],['newUnits','New units','num'],['tv','Est. '+tname(A.trade),'num'],['score','Score','num']];
  $('#alltable').innerHTML='<thead><tr>'+cols.map(k=>`<th class="${k[2]||''}" data-k="${k[0]}">${esc(k[1])}${sortK===k[0]?(sortDir>0?' ↑':' ↓'):''}</th>`).join('')+'</tr></thead><tbody>'+list.slice(0,allShown).map(j=>row(j)).join('')+'</tbody>';
  $('#allmore').innerHTML=more('allmorebtn',allShown,list.length);
  if($('#allmorebtn')) $('#allmorebtn').onclick=()=>{allShown+=PAGE;allJobs()};
  document.querySelectorAll('#alltable th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=(k==='name'||k==='age'||k==='kind')?1:-1}allJobs()});
  bind('#alltable');
}
function people(){
  const c=callJobs();
  const group=(keyFn,roleFn)=>{const g=new Map();c.forEach(j=>{const k=keyFn(j);if(!k)return;const e=g.get(k)||{name:k,role:roleFn(j),jobs:[]};e.jobs.push(j);g.set(k,e)});return [...g.values()].filter(e=>e.jobs.length>1).sort((a,b)=>sum(b.jobs,'tv')-sum(a.jobs,'tv')).slice(0,40)};
  const table=(rows,label)=>'<thead><tr><th>'+label+'</th><th class="num">Jobs on list</th><th class="num">Est. '+esc(tname(A.trade))+'</th><th>Projects</th></tr></thead><tbody>'+(rows.map(e=>`<tr><td class="addr">${esc(e.name)}<div class="sub">${esc(e.role)}</div><a class="sub" href="${esc(gsearch(e.name+' '+e.role+' New York'))}" target="_blank" rel="noopener">Look up ↗</a></td><td class="num">${e.jobs.length}</td><td class="num">${fmt$(sum(e.jobs,'tv'))}</td><td>${e.jobs.slice(0,12).map(j=>`<a class="chip" href="#job-${esc(j.id)}">${esc(j.addr)}</a>`).join('')}${e.jobs.length>12?`<span class="sub"> +${e.jobs.length-12} more</span>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="sub">Nobody has more than one job on the current call list. Widen the window.</td></tr>')+'</tbody>';
  $('#ownertable').innerHTML=table(group(j=>j.ownerBiz||j.owner,j=>'Owner · '+j.ownerType),'Owner or developer');
  $('#protable').innerHTML=table(group(j=>j.appBiz,j=>'Design firm'),'Architect or engineer');
  $('#gctable').innerHTML=table(group(j=>j.gc&&j.gc[0],j=>'Contractor on permit'),'General contractor');
}
function shareTable(){
  $('#sharetable').innerHTML='<thead><tr><th>Trade</th><th class="num">Share of cost</th><th>What it covers</th></tr></thead><tbody>'+Object.values(TRADES).map(t=>`<tr><td>${t.n}</td><td class="num">${Math.round(t.s*100)}%</td><td>${esc(t.need)}</td></tr>`).join('')+'</tbody>';
  $('#how-pull').textContent=`This page holds ${fmtN(jobs.length)} initial filings dated ${fdate(SINCE)} to ${fdate(PULLED)}: every New Building and Alteration-CO filing, plus plain Alterations with a filed cost of ${fmt$(SRC.altMinCost)} or more.`;
}
function jobView(id){
  const j=byId.get(id);
  if(!j){$('#v-job').innerHTML='<section><h2>Project not found</h2><p><a href="#jobs">Back to all filings</a></p></section>';return}
  const T=TRADES[A.trade];
  const why=j.stage<0?'The filing was withdrawn.':PUBLIC.test(j.ownerType)?'Public owner: goes to public bid.':!j.c2?'Under 5,000 sq ft, under 5 units and under '+fmt$(SRC.altMinCost)+' filed cost.':!j.c3?'Over 250,000 sq ft or $50M: a major-GC job.':!j.inWin?`Filed ${j.age} days ago, outside the last ${A.days} days.`:j.stage>=4?'Already signed off.':A.boro&&j.boro!==A.boro?'Outside the selected borough.':'Filtered out by the stage setting.';
  const sameOwner=jobs.filter(x=>x!==j&&(j.ownerBiz?x.ownerBiz===j.ownerBiz:x.owner===j.owner&&!x.ownerBiz)).slice(0,10);
  const steps=STAGES.map((s,i)=>`<div class="${i<=j.stage?'on':''}">${s}${i===0?' · '+fdate(j.date):i===2&&j.approved?' · '+fdate(j.approved):i===3&&j.permitDate?' · '+fdate(j.permitDate):''}</div>`).join('');
  const N=tradeNeeds(j);
  const keys=[A.trade,...Object.keys(TRADES).filter(k=>k!==A.trade)];
  const team=[['Owner',j.ownerBiz||j.owner,j.ownerBiz?j.owner+' · '+j.ownerType:j.ownerType],[proTitle(j)+' of record',j.appBiz||j.applicant,j.appBiz?j.applicant+(j.appAddr?' · '+j.appAddr:''):j.appAddr],j.rep?['Filing representative (expediter)',j.rep,'Files the paperwork; knows where the job stands']:null,j.gc?['Contractor on permit',j.gc[0],j.gc[1]+' · '+j.gc[2]+' permit issued '+fdate(j.gc[3])]:null].filter(x=>x&&x[1]);
  $('#v-job').innerHTML=`<section>
    <div class="eyebrow"><a href="#call-list">Call list</a> / ${esc(j.boro)} / ${esc(j.id)}</div>
    <div class="job-hero"><div><h2>${esc(j.addr)}</h2><div class="sub" style="margin:-4px 0 8px">${esc(j.nta?j.nta+', ':'')}${esc(j.boro)} ${esc(j.zip)} · <b style="color:var(--ink)">Filed ${fdate(j.date)}</b> (${ago(j)})${newPill(j)}</div><div>${kindPill(j)} ${stagePill(j)} ${j.c4?`<span class="chip">Call list · score ${j.score}</span>`:`<span class="chip">Not on the call list. ${esc(why)}</span>`}</div></div>
    <div style="text-align:right"><div class="eyebrow">Est. ${esc(tname(A.trade))}</div><div class="big" style="font-size:64px">${fmt$(j.tv)}</div><div class="sub">${j.fromCost?`of ${fmt$(j.value)} cost filed with DOB`:`of ${fmt$(j.value)} at $${A.psf}/sq ft (no cost filed)`}</div></div></div>
  </section>
  <div class="panel pad" style="margin-bottom:20px">
    <h3>Where it stands</h3>
    <div class="steps">${steps}</div>
    <p class="note" style="margin:0">DOB status: <b style="color:var(--ink)">${esc(j.status)}</b>${j.statusDate?' as of '+fdate(j.statusDate):''}. ${j.gc?`${esc(j.gc[0])} holds the ${esc(j.gc[2].toLowerCase())} permit.`:'No contractor is on a permit for this job yet.'}</p>
  </div>
  <div class="grid2">
    <div class="panel pad">
      <h3>What the filing says</h3>
      <dl class="facts">
        <dt>Date filed</dt><dd>${fdate(j.date)} <span class="sub">(${ago(j)})</span></dd>
        <dt>DOB job number</dt><dd>${esc(j.id)}</dd>
        <dt>Job type</dt><dd>${esc(j.jobType)}</dd>
        <dt>Building type</dt><dd>${esc(j.bldg||'Not stated')}</dd>
        <dt>Description (as filed)</dt><dd>${esc(j.desc||'None')}</dd>
        <dt>Floor area of work</dt><dd>${j.sqfa?fmtN(j.sqfa)+' sq ft':'Not stated'}</dd>
        <dt>Filed cost</dt><dd>${j.cost?'$'+fmtN(j.cost):'Not filed <span class="sub">(DOB does not ask for it on new buildings)</span>'}</dd>
        <dt>Stories</dt><dd>${j.stories?j.stories+(j.whole?'':' <span class="sub">(whole building)</span>'):'Not stated'}</dd>
        <dt>Dwelling units</dt><dd>${j.units?j.units+(j.kind.k==='new'?'':` in the building after the work (${j.exUnits} existing)`):'None'}</dd>
        <dt>Block and lot</dt><dd>${esc(j.bbl||'Not stated')}${j.bin?' <span class="sub">BIN '+esc(j.bin)+'</span>':''}</dd>
      </dl>
    </div>
    <div style="display:grid;gap:20px">
      <div class="panel pad"><h3>Every trade on this job</h3><table class="mini"><tbody>${Object.entries(TRADES).map(([k,t])=>`<tr${k===A.trade?' style="color:var(--accent)"':''}><td>${t.n}</td><td class="num">${fmt$(tradeValue(j,k))}</td></tr>`).join('')}</tbody></table><p class="note">Rule-of-thumb shares of ${j.fromCost?'the cost filed with DOB, which owners often understate':'an estimate from floor area'}.</p></div>
      ${sameOwner.length?`<div class="panel pad"><h3>Same owner, other filings</h3>${sameOwner.map(s=>`<a class="chip" href="#job-${esc(s.id)}">${esc(s.addr)}</a>`).join('')}<p class="note">One relationship, several jobs.</p></div>`:''}
    </div>
  </div>
  <section style="padding-bottom:0"><div class="panel pad" style="border-color:var(--accent)">
    <h3>Who's on the project</h3>
    <div class="cards">${team.map(p=>`<a class="card" href="${esc(gsearch(p[1]+' '+(p[0]==='Owner'?j.boro:p[0].split(' ')[0])+' NY'))}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span>${esc(p[0])}</span><b>${esc(p[1])} ↗</b>${p[2]?`<span>${esc(p[2])}</span>`:''}</a>`).join('')}</div>
    <p class="note">Names are from the DOB filing${j.gc?' and permit':''}. DOB does not publish phone numbers or emails here; tap a name to look up the firm.</p>
  </div></section>
  <section style="padding-bottom:0"><div class="panel pad">
    <h3>What they need from each trade</h3>
    <p class="note" style="margin-top:-4px">Each card quotes the filing where it mentions the trade, then what the filing's numbers and checked work types mean. Your trade is first.</p>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${keys.map(k=>{const E=evidence(j,k);return `<div class="card" style="${k===A.trade?'border-color:var(--accent)':''}"><b style="display:flex;justify-content:space-between;gap:8px"><span${k===A.trade?' style="color:var(--accent)"':''}>${TRADES[k].n}</span><span class="sub" style="font-family:var(--mono)">~${fmt$(tradeValue(j,k))}</span></b>${E.length?`<div style="margin:8px 0 6px;font-size:12.5px"><div class="eyebrow" style="margin-bottom:4px">The filing says</div>${E.map(e=>`<div style="border-left:2px solid var(--accent);padding:2px 0 2px 8px;margin-bottom:6px;color:var(--ink)">&ldquo;${esc(e)}&rdquo;</div>`).join('')}</div>`:`<div class="sub" style="margin:8px 0 6px;font-size:12px">The description doesn't mention this trade directly.</div>`}<div class="eyebrow" style="margin:8px 0 2px">What that means for you</div><ul style="margin:4px 0 0;padding-left:18px;font-size:13px;color:var(--mute)">${N[k].map(x=>`<li style="margin-bottom:4px">${esc(x)}${TYPICAL.test(x)?' <span class="chip" style="font-size:10px">typical, not stated</span>':''}</li>`).join('')}</ul></div>`}).join('')}</div>
  </div></section>
  <section>
    <div class="panel pad">
      <h3>Open the filing</h3>
      <div class="cards">${linksOf(j).map(l=>`<a class="card" href="${esc(l.u)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;${l.hot?'border-color:var(--accent)':''}"><b>${esc(l.t)} ↗</b><span>${esc(l.s)}</span></a>`).join('')}</div>
    </div>
  </section>
  <section style="padding-top:0">
    <div class="panel pad">
      <div class="row-actions" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Touch 1 · the owner</h3><button class="btn" id="copy1">Copy email</button></div>
      <div class="email">${esc(emailOwner(j))}</div>
      <p class="note">Fill in the bracketed parts first. The range is your trade's rough share of the job; adjust it once you've seen the plans.</p>
    </div>
  </section>
  <section style="padding-top:0">
    <div class="panel pad">
      <div class="row-actions" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Touch 2 · ${j.gc?'the contractor on the permit':'the '+proTitle(j).toLowerCase()+' of record'}</h3><button class="btn" id="copy2">Copy email</button></div>
      <div class="email">${esc(emailPro(j))}</div>
    </div>
  </section>`;
  const cp=(sel,fn)=>{$(sel).onclick=async()=>{try{await navigator.clipboard.writeText(fn(j));$(sel).textContent='Copied'}catch(e){$(sel).textContent='Select and copy the text'}}};
  cp('#copy1',emailOwner); cp('#copy2',emailPro);
  window.scrollTo(0,0);
}

let hits=[];
function drawMap(){
  const cv=$('#map'); if(!cv||cv.offsetParent===null) return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const cosL=Math.cos(40.7*Math.PI/180);
  const proj=j=>[(j.lng+74)*cosL,j.lat-40.7];
  const all=jobs.filter(j=>j.lat&&j.lng&&j.lat>40.4&&j.lat<41&&j.lng>-74.3&&j.lng<-73.6);
  const pts=all.filter(j=>j.inWin&&j.c3&&(!A.boro||j.boro===A.boro));
  hits=[]; if(!pts.length) return;
  const frame=(A.boro?pts:all).map(proj);
  const xs=frame.map(p=>p[0]),ys=frame.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=26,top=70;
  const s=Math.min((W-2*pad)/(maxX-minX||1),(H-top-pad)/(maxY-minY||1));
  const ox=pad+((W-2*pad)-(maxX-minX)*s)/2;
  const Tf=p=>[ox+(p[0]-minX)*s,H-pad-(p[1]-minY)*s];
  g.strokeStyle='#232b36';g.lineWidth=1;
  for(let i=0;i<=8;i++){const yy=minY+(maxY-minY)*i/8,a=Tf([minX,yy]),b=Tf([maxX,yy]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();const xx=minX+(maxX-minX)*i/8,c=Tf([xx,minY]),d=Tf([xx,maxY]);g.beginPath();g.moveTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.stroke();}
  const items=pts.map(j=>({j,p:Tf(proj(j))})).sort((a,b)=>(a.j.c4-b.j.c4)||(a.p[1]-b.p[1]));
  const bw=3;
  items.forEach(({j,p})=>{
    const h=4+Math.sqrt(Math.min(j.value,50e6)/50e6)*70;
    const hot=j.c4;
    g.fillStyle=hot?'#ffb020':'#4b5f75';g.fillRect(p[0]-bw,p[1]-h,bw,h);
    g.fillStyle=hot?'#c7850e':'#38485a';g.fillRect(p[0],p[1]-h,bw,h);
    hits.push({x:p[0],y0:p[1]-h-3,y1:p[1],j});
  });
  if(!A.boro){
    const bc={};all.forEach(j=>{const q=Tf(proj(j));const e=bc[j.boro] ||= {x:0,y:0,n:0};e.x+=q[0];e.y+=q[1];e.n++});
    g.font='600 11px "IBM Plex Mono", monospace';g.textAlign='center';
    Object.entries(bc).forEach(([k,v])=>{const x=v.x/v.n,y=v.y/v.n+16;const w=g.measureText(k).width+12;g.fillStyle='rgba(18,22,28,.85)';g.fillRect(x-w/2,y-12,w,18);g.fillStyle='#e8ecf1';g.fillText(k,x,y+1)});
  }
}
function hitAt(ev){const r=$('#map').getBoundingClientRect();const x=ev.clientX-r.left,y=ev.clientY-r.top;let best=null,bd=7;for(let i=hits.length-1;i>=0;i--){const h=hits[i];const dx=Math.abs(h.x-x);if(dx<bd&&y>=h.y0-4&&y<=h.y1+4){bd=dx;best=h}}return best}

function refresh(){compute();callShown=PAGE;allShown=PAGE;ticker();route()}
function route(){
  const h=(location.hash||'#home').slice(1);
  const v=h.startsWith('job-')?'job':(['home','call-list','jobs','people','how'].includes(h)?h:'home');
  document.querySelectorAll('.view').forEach(e=>e.classList.add('hide'));
  $('#v-'+v).classList.remove('hide');
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='home')home();if(v==='call-list')callList();if(v==='jobs')allJobs();if(v==='people')people();if(v==='how')shareTable();if(v==='job')jobView(h.slice(4));
}
function init(){
  BOROS.forEach(b=>$('#f-b').insertAdjacentHTML('beforeend',`<option>${esc(b)}</option>`));
  Object.entries(KINDS).forEach(([k,v])=>$('#f-s').insertAdjacentHTML('beforeend',`<option value="${esc(k)}">${esc(v.t)}</option>`));
  STAGES.forEach((s,i)=>$('#f-st').insertAdjacentHTML('beforeend',`<option value="${i}">${esc(s)}</option>`));
  ['#f-q','#f-b','#f-s','#f-st','#f-c'].forEach(s=>$(s).addEventListener('input',()=>{allShown=PAGE;allJobs()}));
  tradebar();borobar();assumeControls();
  const cv=$('#map');
  cv.addEventListener('mousemove',e=>{const h=hitAt(e);cv.style.cursor=h?'pointer':'crosshair';$('#map-hint').textContent=h?`${h.j.addr}, ${h.j.boro} · ${fmt$(h.j.value)} · ${h.j.kind.t} · ${h.j.stage<0?'Withdrawn':STAGES[h.j.stage]}`:'Bar height is estimated value. Click a bar to open the project.'});
  cv.addEventListener('click',e=>{const h=hitAt(e);if(h)location.hash='job-'+h.j.id});
  window.addEventListener('resize',()=>{if(!$('#v-home').classList.contains('hide'))drawMap()});
  window.addEventListener('hashchange',route);
  refresh();
}
init();
