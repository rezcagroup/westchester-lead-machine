const RAW = __DATA__;
const CONTACTS = __CONTACTS__;
const ATT = __ATT__;
const TEAM = __TEAM__;
const EV = __EV__;
const FS = "https://services.arcgis.com/XKEHpOulfycN9cGC/arcgis/rest/services/Westchester_County_Referrals_2_view/FeatureServer/0/";
const DASH = "https://experience.arcgis.com/experience/e5fa3d5d5b80476396a3f68eaf606db2/";
const gsearch = q => "https://www.google.com/search?q="+encodeURIComponent(q);
const PULLED = "11 Nov 2026";
const TODAY = Date.UTC(2026,10,11);
const TRADES = {
  gc:{n:'GC / framing',s:.22,need:'general contracting, framing and carpentry'},
  concrete:{n:'Concrete',s:.08,need:'footings, foundation walls, slabs and site concrete'},
  site:{n:'Site work',s:.07,need:'clearing, excavation, utilities, drainage and paving'},
  hvac:{n:'HVAC',s:.10,need:'heating, cooling and ventilation'},
  elec:{n:'Electrical',s:.09,need:'service, distribution, lighting and low voltage'},
  plumb:{n:'Plumbing',s:.07,need:'domestic water, sanitary, gas and fixtures'},
  roof:{n:'Roofing',s:.03,need:'roofing, flashing and waterproofing'},
  windows:{n:'Windows & doors',s:.05,need:'windows, storefront and exterior doors'},
  paint:{n:'Painting',s:.03,need:'interior and exterior painting, coatings and wall finishes'}
};
const A = {psf:450, trade:'concrete', days:30};
try{const s=JSON.parse(localStorage.getItem('wcl-assume')||'null'); if(s){A.psf=s.psf||A.psf; if(TRADES[s.trade])A.trade=s.trade; if([7,14,30,60,90,180].includes(s.days))A.days=s.days;}}catch(e){}
const PUBLIC = /Institutional|Utilities|Recreation/;
const fmt$ = v => v>=1e9? '$'+(v/1e9).toFixed(2)+'B' : v>=1e6? '$'+(v/1e6).toFixed(1)+'M' : v>=1e3? '$'+Math.round(v/1e3)+'K' : '$'+Math.round(v);
const fmtN = v => Math.round(v).toLocaleString('en-US');
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fdate = iso => { const [y,m,d]=iso.split('-').map(Number); return d+' '+MON[m-1]+' '+y; };
const daysAgo = iso => { const [y,m,d]=iso.split('-').map(Number); return Math.round((TODAY-Date.UTC(y,m-1,d))/864e5); };

const jobs = RAW.map(r=>{
  const [id,name,agency,town,action,sqfa,sqd,addr,lat,lng,date,use,units,affh,comm,desc,stories,parking,acres,rec,recTitle,recAgency]=r;
  const txt=(name+' '+desc);
  let kind;
  if(/re-?approval|amend|extension|modif|revis/i.test(txt)) kind={k:'amend',t:'Changes an earlier approval',w:5};
  else if(/renovat|conver|change of use|interior|fit-?out|reuse|re-use|existing building/i.test(txt) && !/construct|erect|new (building|\d)|proposed (\d|a new|new)|develop/i.test(txt)) kind={k:'reno',t:'Renovation or change of use',w:15};
  else kind={k:'new',t:'New construction',w:25};
  return {id,name:name.trim(),agency,town,action,sqfa,sqd,addr,lat,lng,date,use:use||'Not classified',units,affh,comm,desc,stories,parking,acres,rec,recTitle,recAgency,kind,age:daysAgo(date),zone:(EV[id]||{}).z||'',cm:(EV[id]||{}).cm||[]};
});

function compute(){
  const T=TRADES[A.trade];
  jobs.forEach(j=>{
    j.value = j.sqfa*A.psf;
    j.tv = A.trade==='site' ? Math.max(j.value*T.s, j.sqd*12) : j.value*T.s;
    j.c1 = !PUBLIC.test(j.use);
    j.c2 = j.c1 && (j.sqfa>=5000 || j.units>=5);
    j.c3 = j.c2 && j.sqfa<=250000;
    j.c4 = j.c3 && j.age<=A.days;
    j.score = j.c4 ? Math.round(Math.max(0,35-j.age/A.days*35) + Math.min(35,Math.max(0,(Math.log10(Math.max(j.sqfa,1000))-3.5)*18)) + j.kind.w + (j.units>0?5:0)) : 0;
  });
}
function ago(j){return j.age===0?'today':j.age===1?'yesterday':j.age+' days ago'}
function newPill(j){return j.age<=14?'<span class="pill p-go" style="margin-left:6px">NEW</span>':''}
function kindPill(j){return `<span class="pill p-${j.kind.k==='new'?'go':j.kind.k==='reno'?'rev':'wait'}">${esc(j.kind.t)}</span>`}

function contactOf(j){return CONTACTS[j.town]||{}}
function linksOf(j){
  const C=contactOf(j), L=[];
  if(ATT[j.id]) L.push({t:'County file (PDF)',s:'Plans or letter attached to county file '+j.id,u:FS+ATT[j.id][0]+'/attachments/'+ATT[j.id][1],hot:1});
  if(C.page) L.push({t:C.pageLabel,s:'Town page with agendas and application documents',u:C.page});
  if(C.page2) L.push({t:C.page2Label,s:'Official project map',u:C.page2});
  L.push({t:'Find the filing online',s:'Search for this project\'s agenda, plans and applicant',u:gsearch('"'+j.name.trim()+'" '+j.town+' NY planning board')});
  if(!C.page) L.push({t:j.town+' planning board page',s:'Search for the town\'s agendas and current applications',u:gsearch(j.town+' NY planning board agenda current applications')});
  L.push({t:'County referral dashboard',s:'Look up file '+j.id+' on the county map',u:DASH});
  return L;
}
function teamText(j){const t=TEAM[j.id];return t?t.people.map(p=>p[0]+': '+p[1]+(p[2]?' ('+p[2]+')':'')).join('; '):''}
function sheetRow(j){const C=contactOf(j);const l=linksOf(j)[0];return [j.date,j.name,j.town,j.addr,j.sqfa||'',j.units||'',j.kind.t,j.desc,teamText(j),j.rec||'',j.recTitle||'',C.email||'',C.plan||'',C.bld||'',l.u].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')}
function sheet(list){return ['Filed,Project,Town,Address,Sq ft,Units,Type,Filing description,Team on file,Planning contact,Title,Email,Planning phone,Building dept phone,Filing link'].concat(list.map(sheetRow)).join('\n')}


const BOILER=/^(CPBP|Recycle|TDM|AFFO|UNIVERSAL|AIR|ZONE|Disp|Oth)$/;
const KEYS={
  gc:/(\bstor(y|ies)\b|\bunits?\b|construct|build|erect|addition|renovat|demoli|amenit|courtyard|civic space|plaza|elevator)/i,
  concrete:/(foundation|slab|concrete|parking|garage|deck|retaining|\bwalls?\b|podium|sidewalk|curb|\bpool|plaza|crosswalk|cellar|basement)/i,
  site:/(\bacres?\b|disturb|grad(e|ing)|excavat|demoli|parking|paving|driveway|stormwater|drainage|sewer|utilit|\btrees?\b|wetland|slope|\brock|landscap|retaining|watershed|flood|crosswalk|sidewalk|roadway|infiltration)/i,
  hvac:/(hvac|heat|cool|mechanical|ventilat|rooftop unit|electrif|fossil|natural gas|energy|green building|all-electric|geothermal)/i,
  elec:/(electric|solar|\bev\b|e-bike|charging|lighting|generator|battery|elevator|outlet|energy)/i,
  plumb:/(plumb|bath|kitchen|laundry|sprinkler|\bwater\b|sewer|sewage|\bpool|restaurant|food|fixture|infiltration)/i,
  roof:/(\broofs?\b|rooftop|solar|terrace|green roof)/i,
  windows:/(window|storefront|fa[cç]ade|glass|glazing|\bdoors?\b|retail|elevation|architectur)/i,
  paint:/(fa[cç]ade|finish|interior|renovat|exterior|mural|colou?r|architectur|historic|design)/i
};
function sentences(t){return (t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(x=>x.length>12)}
function evidence(j,k){
  const out=[], re=KEYS[k];
  sentences(j.desc).forEach(x=>{if(re.test(x))out.push({q:x,src:'Project description'})});
  ((EV[j.id]||{}).cm||[]).forEach(c=>{if(BOILER.test(c[0]))return;sentences(c[2]).slice(0,3).forEach(x=>{if(re.test(x)&&!/County Planning Board.?s long-range|we encourage the|county regulations for/i.test(x))out.push({q:x,src:'County review: '+c[1]})})});
  const seen=new Set();return out.filter(o=>{const key=o.q.slice(0,60);if(seen.has(key))return false;seen.add(key);return true}).slice(0,4);
}
const TYPICAL=/(usually|likely|typical|common|est\.|often|Low voltage|New water, sewer|New drywall|Kitchen and bath exhaust|Flat membrane|Pitched shingle|Flat or low-slope|plan for grading)/;

function tradeNeeds(j){
  const d=(j.name+' '+j.desc+' '+j.cm.filter(c=>!BOILER.test(c[0])).map(c=>c[2]).join(' ')).toLowerCase(), has=re=>re.test(d);
  const st=Math.max(1,j.stories||(j.units>20?4:2)), foot=j.sqfa?Math.round(j.sqfa/st):0;
  const house=j.units<=2 && !j.comm && j.use==='Residential';
  const multi=j.units>=3;
  const f={stormsub:has(/subsurface storm|underground storm|detention tank|infiltration/),ebike:has(/e-bike|e-bicycle|charge e-/),demo:has(/demol|raze|remove existing|existing structure/),pool:has(/\bpool/),garage:has(/structured parking|parking garage|parking structure|garage|below[- ]grade parking|parking deck/),wall:has(/retaining wall/),storage:has(/self[- ]?storage|storage facility/),retail:j.comm>0&&j.use!=='Commercial or Office'||has(/retail/),solar:has(/solar/),roofdeck:has(/roof ?deck|rooftop|green roof|amenity/),ev:has(/\bev\b|electric vehicle|charging/),rock:has(/rock|blast|steep slope/),water:has(/waterfront|flood|wetland|hudson river|brook/),reapp:j.kind.k==='amend',reno:j.kind.k==='reno'};
  const n=fmtN, out={};
  const what = house?`a ${st}-story single-family house`:multi?`a ${st}-story, ${j.units}-unit ${j.comm?'mixed-use ':''}building`:`a ${st}-story ${j.use.toLowerCase()} building`;
  out.gc=[ f.reno?`Fit-out of an existing building (${j.sqfa?n(j.sqfa)+' sq ft':'size not stated'}): demo, framing, finishes, code upgrades.`:`Ground-up build of ${what}${j.sqfa?`, about ${n(j.sqfa)} sq ft`:''}.`,
    f.reapp?'This is a re-approval of an earlier plan, so ask whether a builder is already attached.':'No builder is named in the filing yet.',
    st>=4&&!house?'4+ stories usually means an elevator, sprinklers and a fire-rated stair core.':null,
    f.storage?'Self-storage: long, repetitive interior partition and door package.':null ];
  out.concrete=[ foot?`Footings and foundation under a footprint of roughly ${n(foot)} sq ft (floor area ÷ stories).`:'Footings and slab; footprint not stated in the filing.',
    f.garage||j.parking>40?`Parking${j.parking?' for '+j.parking+' cars':''}${f.garage?' in a garage or deck: structured slabs, ramps and walls':' on grade: curbs, pads and walks'}.`:null,
    st>=6&&!house?`${st} stories: likely a concrete podium or frame, plus elevator pit and stair cores.`:null,
    f.wall?'Retaining walls are called out in the filing.':null,
    f.pool?'Pool shell (gunite) and pool deck.':null,
    f.reno?'Renovation: expect limited concrete, mostly new openings, pads and sidewalk repairs.':'New sidewalk, curb and aprons at the street.' ];
  out.site=[ j.sqd?`About ${n(j.sqd)} sq ft of land disturbance${j.acres?' on a '+j.acres+'-acre site':''}: clearing, grading, erosion control.`:'Land disturbance not stated; plan for grading and erosion control.',
    f.demo?'Demolition of the existing structure comes first.':null,
    j.parking?`Paving and striping for ${j.parking} parking spaces.`:null,
    f.stormsub?'Plans include subsurface stormwater quality and retention systems: excavation and installation of underground chambers or tanks.':'New water, sewer and storm connections; stormwater detention to meet town rules.',
    f.rock?'Rock or steep slopes are mentioned: excavation and possible blasting or chipping.':null,
    f.water?'Near water or wetlands: extra permits, silt control and possibly flood-proofing.':null,
    f.wall?'Retaining walls on the site plan.':null ];
  out.hvac=[ multi?`${j.units} apartments: one heating/cooling system per unit (typically heat pumps or VRF), plus corridors and common areas.`:house?'Whole-house heating, cooling and ventilation, likely multi-zone for a house this size.':`Heating and cooling for ${j.sqfa?n(j.sqfa)+' sq ft of':''} ${j.use.toLowerCase()} space, likely rooftop units.`,
    j.comm&&multi?`Separate systems for ${n(j.comm)} sq ft of commercial space.`:null,
    f.garage?'Garage exhaust and CO ventilation.':null,
    multi?'Kitchen and bath exhaust for every unit.':null ];
  out.elec=[ multi?`New service with ${j.units} unit meters plus a house panel.`:house?'New residential service, likely 200A or more for a house this size.':`Commercial service and distribution for ${j.sqfa?n(j.sqfa)+' sq ft':'the building'}.`,
    st>=4&&!house?'Elevator power, fire alarm and emergency lighting.':null,
    j.parking?`Site and parking lighting${j.parking>=10?'; EV-ready circuits are now common on new lots':''}.`:null,
    f.solar?'Solar is mentioned in the filing.':null,
    f.ebike?'County asked for e-bike charging outlets in the bike room.':null,
    f.pool?'Pool equipment, bonding and lighting.':null,
    'Low voltage: intercom, access control, data.' ];
  out.plumb=[ multi?`${j.units} kitchens and roughly ${Math.round(j.units*1.4)} bathrooms (est.), plus laundry.`:house?'Full house plumbing: kitchen, baths, laundry, gas.':`Restrooms and fixtures for ${j.use.toLowerCase()} use.`,
    (multi&&j.units>=3)||st>=4?'Fire sprinkler system and a domestic water booster are likely.':null,
    j.comm?'Separate commercial plumbing and grease or gas lines if there is food service.':null,
    f.pool?'Pool plumbing and filtration.':null ];
  out.roof=[ foot?`Roughly ${n(foot)} sq ft of roof (about the footprint).`:'Roof area not stated in the filing.',
    st>=4&&!house?'Flat membrane roof with mechanical equipment curbs.':house?'Pitched shingle or slate roof typical for a house.':'Flat or low-slope commercial roof.',
    f.roofdeck?(has(/green roof/)?'Green roof called out in the plans: waterproofing, root barrier, drainage mat and growing medium.':'Roof deck or rooftop amenity is mentioned.'):null,
    f.solar?'Coordinate with solar panel installation.':null ];
  out.windows=[ multi?`Windows for ${j.units} apartments across ${st} floors (often 6 to 10 openings per unit).`:house?'Full window and exterior door package for a new house.':`Windows and entries for ${j.sqfa?n(j.sqfa)+' sq ft of':''} ${j.use.toLowerCase()} space.`,
    j.comm||f.retail?'Storefront glazing at street level for the commercial space.':null,
    f.garage?'Garage doors or overhead doors.':null,
    f.storage?'Roll-up doors for storage units.':null ];
  out.paint=[ j.sqfa?`Roughly ${n(Math.round(j.sqfa*3/1000)*1000)} sq ft of walls and ceilings to paint (about 3× the ${n(j.sqfa)} sq ft floor area).`:'Interior walls and ceilings; floor area not stated in the filing.',
    multi?`${j.units} apartment interiors plus corridors, stairwells and lobby.`:house?'Full interior of a new house plus exterior trim, doors and siding if not prefinished.':`${j.use} interiors${j.comm?', including '+n(j.comm)+' sq ft of commercial space':''}.`,
    f.reno?'Renovation: repaint existing surfaces, patch and prep after demo.':'New drywall: prime, two finish coats, and touch-up at turnover.',
    f.garage||j.parking>40?'Garage or deck: concrete sealers, wall and column paint, line striping.':null,
    f.storage||j.use==='Industrial'?'Steel and metal coatings, possibly intumescent fireproofing paint.':null,
    st>=4&&!house?'Exterior: railings, balconies and metal panels may need field coatings.':null ];
  for(const k in out) out[k]=out[k].filter(Boolean);
  return out;
}

function emailPlanner(j){
  const first=(j.rec||'').split(' ')[0]||'there';
  const C=contactOf(j);
  return `${C.email?'To: '+C.email+'\n':''}Subject: ${j.name}, ${j.town}: applicant contact

Hi ${first},

I saw ${j.name} (${j.addr.split(',')[0]}) on the County Planning Board referrals, county file ${j.id}. Could you share the applicant's name and contact, and the project engineer or architect? I'd also like to know when it's next on the ${j.agency||'board'} agenda.

We're a [${TRADES[A.trade].n.toLowerCase()}] contractor based in Westchester and would like to get in front of the applicant early.

Thanks,
[Your name]
[Company] · [Phone]`;
}
function emailApplicant(j){
  const T=TRADES[A.trade];
  const scope=[j.sqfa?`${fmtN(j.sqfa)} sq ft`:'', j.units?`${j.units} units`:'', j.stories?`${j.stories} stories`:''].filter(Boolean).join(', ');
  return `Subject: ${j.name}, ${j.town}: ${T.n.toLowerCase()}

Hi [applicant first name],

I saw ${j.name} at ${j.addr.split(',')[0]} come through ${j.town}'s ${j.agency||'planning board'} review${scope?` (${scope})`:''}. Congratulations on getting it moving.

From the filing, the ${T.n.toLowerCase()} side looks like: ${tradeNeeds(j)[A.trade].slice(0,2).map(x=>x.replace(/\.$/,'')).join('; ').replace(/^./,c=>c.toLowerCase())}.

We do ${T.need} on projects like this across Westchester, including [two local jobs]. By our rough math the ${T.n.toLowerCase()} package here is in the ${fmt$(j.tv*0.8)} to ${fmt$(j.tv*1.2)} range. We'd be glad to give you early pricing to help with your budget while the plans are still in review.

Can we get on the bid list? I'll call [Thursday] in case that's easier.

[Your name]
[Company] · [Phone]`;
}

const $ = s=>document.querySelector(s);
function tradebar(){
  $('#tradebar').innerHTML='<span class="lbl">Selling as</span>'+Object.entries(TRADES).map(([k,t])=>`<button class="tbtn ${k===A.trade?'on':''}" data-k="${k}" aria-pressed="${k===A.trade}">${t.n}</button>`).join('');
  document.querySelectorAll('.tbtn').forEach(b=>b.onclick=()=>{A.trade=b.dataset.k;save();tradebar();refresh()});
}
function ticker(){
  $('#ticker').innerHTML=`Pulled ${PULLED} · <b>${jobs.length}</b> referrals read · <b>${jobs.filter(j=>j.c4).length}</b> filed in the last ${A.days} days · $${A.psf}/sq ft · ${TRADES[A.trade].n} at ${Math.round(TRADES[A.trade].s*100)}% of hard cost`;
}
function home(){
  const tot=jobs.reduce((a,j)=>a+j.value,0), T=TRADES[A.trade];
  $('#h-eyebrow').textContent=`Westchester County · Planning Board referrals · Nov 2025 to Nov 2026 · pulled ${PULLED}`;
  const c=jobs.filter(j=>j.c4);
  $('#h-big').textContent=fmt$(c.reduce((a,j)=>a+j.value,0));
  $('#h-lede').innerHTML=`Claude read all <b>${jobs.length}</b> projects Westchester towns sent to the County Planning Board in the last year. <b>${c.length}</b> are private, local-builder size, and were filed in the last ${A.days} days. That's about <b>${fmt$(c.reduce((a,j)=>a+j.tv,0))}</b> of ${T.n.toLowerCase()} work nobody has bid yet. Everything referred in the year, including public work and megaprojects, totals ${fmt$(tot)}.`;
  const s0=jobs,s1=jobs.filter(j=>j.c1),s2=jobs.filter(j=>j.c2),s3=jobs.filter(j=>j.c3),s4=c;
  const steps=[['Referred','Projects with construction scope',s0],['Cut 1','Private, not public or institutional',s1],['Cut 2','A real building: 5,000+ sq ft or 5+ units',s2],['Cut 3','Local-builder size, under 250,000 sq ft',s3],['Call list',`Filed in the last ${A.days} days`,s4]];
  $('#funnel').innerHTML=`<div class="pad" style="padding-bottom:4px"><div class="eyebrow">The bid schedule</div><h3 style="margin:4px 0 8px">From every referral to the first call</h3></div>`+
    steps.map((s,i)=>`<div class="step ${i>=4?'hot':''}"><div class="k">${s[0]}</div><div class="n">${s[2].length}</div><div class="t">${s[1]}</div><div class="m">${fmt$(s[2].reduce((x,j)=>x+j.value,0))} est. value · ${fmt$(s[2].reduce((x,j)=>x+j.tv,0))} ${esc(T.n.toLowerCase())}<div class="bar"><span style="width:${(s[2].length/s0.length*100).toFixed(1)}%"></span></div></div></div>`).join('');
  const units=c.reduce((a,j)=>a+j.units,0);
  const newc=c.filter(j=>j.kind.k==='new');
  const towns={};c.forEach(j=>towns[j.town]=(towns[j.town]||0)+1);
  const topT=Object.entries(towns).sort((a,b)=>b[1]-a[1])[0];
  
  $('#tiles').innerHTML=[
    ['New construction',newc.length,`ground-up projects on the call list`],
    ['Housing units',fmtN(units),'apartments and homes on the call list'],
    ['Filed this week',jobs.filter(j=>j.c3&&j.age<=7).length,'private projects filed in the last 7 days'],
    ['Busiest town',topT?topT[1]:0,topT?topT[0]+' projects on the list':'']
  ].map(t=>`<div class="panel tile"><div class="eyebrow">${t[0]}</div><div class="v">${t[1]}</div><div class="s">${t[2]}</div></div>`).join('');
  const top=c.slice().sort((a,b)=>a.age-b.age||b.score-a.score).slice(0,5);
  $('#top5').innerHTML=head(true)+top.map((j,i)=>row(j,i+1)).join('');
  bind('#top5'); drawMap();
}
function head(rank){return `<thead><tr>${rank?'<th>#</th>':''}<th>Filed</th><th>Project</th><th>Type of work</th><th class="num">Sq ft</th><th class="num">Units</th><th class="num">Est. ${esc(TRADES[A.trade].n.toLowerCase())}</th><th class="num">Score</th></tr></thead>`}
function row(j,rank){
  return `<tr class="row" data-id="${j.id}">${rank!==undefined?`<td class="rank">${rank}</td>`:''}<td class="num" style="text-align:left;white-space:nowrap">${fdate(j.date)}<div class="sub">${ago(j)}</div></td><td><div class="addr">${esc(j.name)}${newPill(j)}${TEAM[j.id]&&TEAM[j.id].people.length?'<span class="pill p-rev" style="margin-left:6px">TEAM FOUND</span>':''}</div><div class="sub">${esc(j.town)} · ${esc(j.use)}</div><div class="sub" style="max-width:52ch;margin-top:2px">${esc(j.desc.length>150?j.desc.slice(0,150).replace(/\s+\S*$/,'')+'…':j.desc)}</div></td><td>${kindPill(j)}</td><td class="num">${j.sqfa?fmtN(j.sqfa):'·'}</td><td class="num">${j.units||'·'}</td><td class="num">${fmt$(j.tv)}</td><td class="num">${j.score||'·'}</td></tr>`;
}
function bind(sel){document.querySelectorAll(sel+' tr.row').forEach(tr=>tr.onclick=()=>{location.hash='job-'+tr.dataset.id})}
function assumeControls(){
  $('#assume1').innerHTML=`<div class="ctl"><label for="a-psf">Hard cost per sq ft</label><input type="range" id="a-psf" min="250" max="900" step="25" value="${A.psf}"><output id="o-psf">$${A.psf}</output></div><div class="note">Switch trades at the top of the page. Every estimate updates.</div><button class="btn ghost" id="sheetbtn" style="margin-left:auto">Copy contact sheet (CSV)</button>`;
  $('#sheetbtn').onclick=async()=>{const c=jobs.filter(j=>j.c4).sort((a,b)=>b.score-a.score);try{await navigator.clipboard.writeText(sheet(c));$('#sheetbtn').textContent='Copied '+c.length+' rows'}catch(e){$('#sheetbtn').textContent='Copy blocked by browser'}};
  $('#assume1').insertAdjacentHTML('afterbegin',`<div class="ctl"><label for="a-days">Filed within</label><select id="a-days">${[7,14,30,60,90,180].map(d=>`<option value="${d}" ${d===A.days?'selected':''}>Last ${d} days</option>`).join('')}</select></div>`);
  $('#a-days').onchange=e=>{A.days=+e.target.value;save();refresh()};
  $('#a-psf').oninput=e=>{A.psf=+e.target.value;$('#o-psf').textContent='$'+A.psf;save();refresh()};
}
function save(){try{localStorage.setItem('wcl-assume',JSON.stringify(A))}catch(e){}}
function callList(){const c=jobs.filter(j=>j.c4).sort((a,b)=>a.age-b.age||b.score-a.score);$('#calltable').innerHTML=head(true)+'<tbody>'+c.map((j,i)=>row(j,i+1)).join('')+'</tbody>';bind('#calltable')}
let sortK='score',sortDir=-1;
function allJobs(){
  const q=$('#f-q').value.toLowerCase(),b=$('#f-b').value,s=$('#f-s').value,c=$('#f-c').value;
  let list=jobs.filter(j=>(!b||j.town===b)&&(!s||j.use===s)&&(!c||j.c4)&&(!q||(j.name+' '+j.addr+' '+j.desc).toLowerCase().includes(q)));
  list.sort((x,y)=>{const a=x[sortK],bb=y[sortK];return (a>bb?1:a<bb?-1:0)*sortDir});
  $('#f-count').textContent=list.length+' projects';
  const cols=[['age','Filed'],['name','Project'],['kind','Type of work'],['sqfa','Sq ft','num'],['units','Units','num'],['tv','Est. '+TRADES[A.trade].n.toLowerCase(),'num'],['score','Score','num']];
  $('#alltable').innerHTML='<thead><tr>'+cols.map(k=>`<th class="${k[2]||''}" data-k="${k[0]}">${esc(k[1])}${sortK===k[0]?(sortDir>0?' ↑':' ↓'):''}</th>`).join('')+'</tr></thead><tbody>'+list.map(j=>row(j)).join('')+'</tbody>';
  document.querySelectorAll('#alltable th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=(k==='name'||k==='age')?1:-1}allJobs()});
  bind('#alltable');
}
function towns(){
  const g={};jobs.forEach(j=>(g[j.town] ||= []).push(j));
  const rows=Object.entries(g).sort((a,b)=>b[1].filter(j=>j.c4).reduce((x,j)=>x+j.tv,0)-a[1].filter(j=>j.c4).reduce((x,j)=>x+j.tv,0));
  $('#towntable').innerHTML='<thead><tr><th>Town</th><th>Planning contact</th><th class="num">Projects</th><th class="num">On call list</th><th class="num">Est. '+esc(TRADES[A.trade].n.toLowerCase())+'</th><th>Call-list projects</th></tr></thead><tbody>'+rows.map(([t,a])=>{
    const on=a.filter(j=>j.c4); const p=a.find(j=>j.rec)||a[0];
    const C=CONTACTS[t]||{};
    return `<tr><td class="addr">${esc(t)}</td><td>${esc(p.rec||'Planning office')}<div class="sub">${esc(p.recTitle)}${p.recAgency?' · '+esc(p.recAgency):''}</div><div class="sub">${C.email?esc(C.email)+' · ':''}${C.plan?'Planning '+esc(C.plan)+' · ':''}${C.bld?'Building '+esc(C.bld):''}</div>${C.page?`<a class="sub" href="${C.page}" target="_blank" rel="noopener">${esc(C.pageLabel)} ↗</a>`:''}</td><td class="num">${a.length}</td><td class="num">${on.length}</td><td class="num">${fmt$(on.reduce((x,j)=>x+j.tv,0))}</td><td>${on.map(j=>`<a class="chip" href="#job-${j.id}">${esc(j.name)}</a>`).join('')||'<span class="sub">None right now</span>'}</td></tr>`}).join('')+'</tbody>';
}
function shareTable(){
  $('#sharetable').innerHTML='<thead><tr><th>Trade</th><th class="num">Share of hard cost</th><th>What it covers</th></tr></thead><tbody>'+Object.values(TRADES).map(t=>`<tr><td>${t.n}</td><td class="num">${Math.round(t.s*100)}%</td><td>${esc(t.need)}</td></tr>`).join('')+'</tbody>';
}
function jobView(id){
  const j=jobs.find(x=>x.id===id);
  if(!j){$('#v-job').innerHTML='<section><h2>Project not found</h2><p><a href="#jobs">Back to all projects</a></p></section>';return}
  const T=TRADES[A.trade];
  const why=!j.c1?'Public or institutional: goes to public bid.':!j.c2?'Under 5,000 sq ft and under 5 units.':!j.c3?'Over 250,000 sq ft: a regional GC job.':!j.c4?`Filed ${j.age} days ago, outside the last ${A.days} days.`:'';
  const same=jobs.filter(x=>x.town===j.town&&x!==j&&x.c4);
  $('#v-job').innerHTML=`<section>
    <div class="eyebrow"><a href="#call-list">Call list</a> / ${esc(j.town)} / ${esc(j.id)}</div>
    <div class="job-hero"><div><h2>${esc(j.name)}</h2><div class="sub" style="margin:-4px 0 8px">${esc(j.addr)} · <b style="color:var(--ink)">Filed ${fdate(j.date)}</b> (${ago(j)})${newPill(j)}</div><div>${kindPill(j)} ${j.c4?`<span class="chip">Call list · score ${j.score}</span>`:`<span class="chip">Not on the call list. ${esc(why)}</span>`}</div></div>
    <div style="text-align:right"><div class="eyebrow">Est. ${esc(T.n.toLowerCase())}</div><div class="big" style="font-size:64px">${fmt$(j.tv)}</div><div class="sub">${j.sqfa?`of ${fmt$(j.value)} hard cost at $${A.psf}/sq ft`:`from ${fmtN(j.sqd)} sq ft of disturbance`}</div></div></div>
  </section>
  <div class="panel pad" style="margin-bottom:20px">
    <h3>Where it stands</h3>
    <div class="steps"><div class="on">County referral · ${fdate(j.date)}</div><div>Local public hearing</div><div>${esc(j.action.split(',')[0])} approval</div><div>Building permit</div><div>Construction</div></div>
    <p class="note" style="margin:0">Filed with the county ${ago(j)}. Typical next steps are shown; the town's planning office has the actual hearing dates.</p>
  </div>
  <div class="grid2">
    <div class="panel pad">
      <h3>What the referral says</h3>
      <dl class="facts">
        <dt>Date filed</dt><dd>${fdate(j.date)} <span class="sub">(${ago(j)})</span></dd>
        <dt>County file</dt><dd>${esc(j.id)}</dd>
        <dt>Town and board</dt><dd>${esc(j.town)} ${esc(j.agency)}</dd>
        <dt>Approvals sought</dt><dd>${esc(j.action)}</dd>
        <dt>Use</dt><dd>${esc(j.use)}</dd>
        <dt>Description (as filed)</dt><dd>${esc(j.desc)}</dd>${j.zone?`<dt>Zoning district</dt><dd>${esc(j.zone)}</dd>`:''}
        <dt>Floor area</dt><dd>${j.sqfa?fmtN(j.sqfa)+' sq ft':'Not stated'}</dd>
        <dt>Land disturbance</dt><dd>${j.sqd?fmtN(j.sqd)+' sq ft':'Not stated'}</dd>
        <dt>Stories</dt><dd>${j.stories||'Not stated'}</dd>
        <dt>Housing units</dt><dd>${j.units?j.units+(j.affh?` (${j.affh} affordable)`:''):'None'}</dd>
        <dt>Commercial space</dt><dd>${j.comm?fmtN(j.comm)+' sq ft':'None stated'}</dd>
        <dt>Parking</dt><dd>${j.parking?j.parking+' spaces':'Not stated'}</dd>
        <dt>Who to ask</dt><dd>${esc(j.rec||'Planning office')}${j.recTitle?', '+esc(j.recTitle):''}${j.recAgency?'<div class="sub">'+esc(j.recAgency)+'</div>':''}</dd>
      </dl>
    </div>
    <div style="display:grid;gap:20px">
      <div class="panel pad"><h3>Every trade on this job</h3><table class="mini"><tbody>${Object.entries(TRADES).map(([k,t])=>{const v=k==='site'?Math.max(j.value*t.s,j.sqd*12):j.value*t.s;return `<tr${k===A.trade?' style="color:var(--accent)"':''}><td>${t.n}</td><td class="num">${fmt$(v)}</td></tr>`}).join('')}</tbody></table><p class="note">Rule-of-thumb shares of hard cost. What each trade gets is spelled out below.</p></div>
      ${same.length?`<div class="panel pad"><h3>Also on the list in ${esc(j.town)}</h3>${same.map(s=>`<a class="chip" href="#job-${s.id}">${esc(s.name)}</a>`).join('')}<p class="note">Same planner, one call.</p></div>`:''}
    </div>
  </div>
  <section style="padding-bottom:0"><div class="panel pad">
    <h3>What they need from each trade</h3>
    <p class="note" style="margin-top:-4px">Each trade quotes the filing and the county's review of the submitted plans, then what it means for that trade. Numbers from the filing: ${j.sqfa?fmtN(j.sqfa)+' sq ft, ':''}${j.stories?j.stories+' stories, ':''}${j.units?j.units+' units, ':''}${j.parking?j.parking+' parking spaces, ':''}${j.sqd?fmtN(j.sqd)+' sq ft disturbed, ':''}Your trade is first.</p>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${(()=>{const N=tradeNeeds(j);const keys=[A.trade,...Object.keys(TRADES).filter(k=>k!==A.trade)];return keys.map(k=>{const v=k==='site'?Math.max(j.value*TRADES[k].s,j.sqd*12):j.value*TRADES[k].s;return `<div class="card" style="${k===A.trade?'border-color:var(--accent)':''}"><b style="display:flex;justify-content:space-between;gap:8px"><span${k===A.trade?' style="color:var(--accent)"':''}>${TRADES[k].n}</span><span class="sub" style="font-family:var(--mono)">${v?'~'+fmt$(v):''}</span></b>${(()=>{const E=evidence(j,k);return E.length?`<div style="margin:8px 0 6px;font-size:12.5px"><div class="eyebrow" style="margin-bottom:4px">The filing says</div>${E.map(e=>`<div style="border-left:2px solid var(--accent);padding:2px 0 2px 8px;margin-bottom:6px;color:var(--ink)">&ldquo;${esc(e.q)}&rdquo;<div class="sub" style="font-size:11px">${esc(e.src)}</div></div>`).join('')}</div>`:`<div class="sub" style="margin:8px 0 6px;font-size:12px">The filing doesn't mention this trade directly. Scope below is from the project's size and type.</div>`})()}<div class="eyebrow" style="margin:8px 0 2px">What that means for you</div><ul style="margin:4px 0 0;padding-left:18px;font-size:13px;color:var(--mute)">${N[k].map(x=>`<li style="margin-bottom:4px">${esc(x)}${TYPICAL.test(x)?' <span class="chip" style="font-size:10px">typical, not stated</span>':''}</li>`).join('')}</ul></div>`}).join('')})()}</div>
  </div></section>
  ${j.cm.length?`<section style="padding-bottom:0"><div class="panel pad"><h3>County's review of the submitted plans</h3><p class="note" style="margin-top:-4px">Written by the County Planning Board after reviewing what the applicant filed. ${j.cm.length} comments.</p><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${j.cm.map(c=>`<div class="card"><b>${esc(c[1]||c[0])}</b><span>${esc(c[2])}${c[2].length>=270?'…':''}</span></div>`).join('')}</div></div></section>`:''}
  ${TEAM[j.id]?`<section style="padding-bottom:0"><div class="panel pad" style="border-color:var(--accent)">
    <h3>Who's on the project</h3>
    ${TEAM[j.id].people.length?`<div class="cards">${TEAM[j.id].people.map(p=>`<a class="card" href="${gsearch(p[1]+' '+(p[0].includes('Owner')||p[0].includes('Developer')?'developer':p[0])+' NY')}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span>${esc(p[0])}</span><b>${esc(p[1])} ↗</b>${p[2]?`<span>${esc(p[2])}</span>`:''}</a>`).join('')}</div>`:''}
    <p class="note">${esc(TEAM[j.id].note)}</p>
    ${TEAM[j.id].src.length?`<p class="note">From public records: ${TEAM[j.id].src.map(x=>`<a href="${x[1]}" target="_blank" rel="noopener">${esc(x[0])}</a>`).join(' · ')}. Tap a name to look up the firm's contact info.</p>`:''}
  </div></section>`:''}
  <section>
    <div class="grid2">
      <div class="panel pad">
        <h3>Open the filing</h3>
        <div class="cards" style="grid-template-columns:1fr">${linksOf(j).map(l=>`<a class="card" href="${l.u}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;${l.hot?'border-color:var(--accent)':''}"><b>${esc(l.t)} ↗</b><span>${esc(l.s)}</span></a>`).join('')}</div>
      </div>
      <div class="panel pad">
        <h3>Who to contact</h3>
        <dl class="facts" style="grid-template-columns:130px 1fr">
          <dt>Planning contact</dt><dd>${esc(j.rec||'Planning office')}${j.recTitle?'<div class="sub">'+esc(j.recTitle)+'</div>':''}</dd>
          <dt>Email</dt><dd>${contactOf(j).email?`${esc(contactOf(j).email)} <button class="btn ghost" id="copyaddr" style="padding:2px 8px;font-size:12px">Copy</button>`:'<span class="sub">Not published. '+esc(j.town)+' takes email through a web form; call instead.</span>'}</dd>
          <dt>Planning phone</dt><dd>${esc(contactOf(j).plan||'Ask the building department to transfer you')}</dd>
          <dt>Building dept</dt><dd>${esc(contactOf(j).bld||'Not listed')}</dd>
          <dt>Office</dt><dd>${esc(j.recAgency||j.town)}</dd>
          <dt>Applicant</dt><dd>${TEAM[j.id]&&TEAM[j.id].people.length?esc(TEAM[j.id].people[0][1]):''}<span class="sub">${TEAM[j.id]&&TEAM[j.id].people.length?' (see team above)':'Not in the county record.'} ${TEAM[j.id]&&TEAM[j.id].people.length?'':' Ask the planner (Touch 1) or open the town&rsquo;s agenda: the applicant, engineer and architect are listed there.'}</span></dd>
        </dl>
      </div>
    </div>
  </section>
  <section style="padding-top:0">
    <div class="panel pad">
      <div class="row-actions" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Touch 1 · ask the town planner for the applicant</h3><button class="btn" id="copy1">Copy email</button></div>
      <div class="email">${esc(emailPlanner(j))}</div>
    </div>
  </section>
  <section style="padding-top:0">
    <div class="panel pad">
      <div class="row-actions" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Touch 2 · email the applicant, then call</h3><button class="btn" id="copy2">Copy email</button></div>
      <div class="email">${esc(emailApplicant(j))}</div>
      <p class="note">Fill in the bracketed parts first. The range is your trade's rough share of an estimated hard cost; adjust it once you've seen the plans.</p>
    </div>
  </section>`;
  const cp=(id,fn)=>{$(id).onclick=async()=>{try{await navigator.clipboard.writeText(fn(j));$(id).textContent='Copied'}catch(e){$(id).textContent='Select and copy the text'}}};
  cp('#copy1',emailPlanner); cp('#copy2',emailApplicant);
  if($('#copyaddr')) $('#copyaddr').onclick=async()=>{try{await navigator.clipboard.writeText(contactOf(j).email);$('#copyaddr').textContent='Copied'}catch(e){}};
  window.scrollTo(0,0);
}

let hits=[];
function drawMap(){
  const cv=$('#map'); if(!cv||cv.offsetParent===null) return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const pts=jobs.filter(j=>j.lat&&j.lng);
  const cosL=Math.cos(41.1*Math.PI/180);
  const iso=j=>{const x=(j.lng+73.8)*cosL,y=(j.lat-41.1);return [(x+y)*0.9,(y-x)*0.45]};
  const raw=pts.map(iso);
  const xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=30,top=100;
  const s=Math.min((W-2*pad)/(maxX-minX),(H-top-pad)/(maxY-minY));
  const ox=pad+((W-2*pad)-(maxX-minX)*s)/2;
  const Tf=p=>[ox+(p[0]-minX)*s,H-pad-(p[1]-minY)*s];
  g.strokeStyle='#2c3542';g.lineWidth=1;
  for(let i=0;i<=8;i++){const yy=minY+(maxY-minY)*i/8,a=Tf([minX,yy]),b=Tf([maxX,yy]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
  for(let i=0;i<=8;i++){const xx=minX+(maxX-minX)*i/8,a=Tf([xx,minY]),b=Tf([xx,maxY]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
  const items=pts.map((j,i)=>({j,p:Tf(raw[i])})).sort((a,b)=>a.p[1]-b.p[1]);
  const cap=300000, maxSq=cap;
  hits=[];const bw=6;
  items.forEach(({j,p})=>{
    const h=5+Math.sqrt(Math.min(j.sqfa||j.sqd/4,cap)/maxSq)*(top+60);
    const hot=j.c4;
    g.fillStyle=hot?'#ffb020':'#4b5f75';g.fillRect(p[0]-bw,p[1]-h,bw,h);
    g.fillStyle=hot?'#c7850e':'#38485a';g.fillRect(p[0],p[1]-h,bw,h);
    g.fillStyle=hot?'#ffd27a':'#6c86a3';g.fillRect(p[0]-bw,p[1]-h-2,bw*2,2);
    hits.push({x:p[0],y0:p[1]-h-3,y1:p[1],j});
  });
  const groups={'Yonkers':0,'New Rochelle':0,'White Plains':0,'Peekskill':0,'Port Chester':0,'Yorktown':0,'Bedford':0,'Greenburgh':0};
  const bc={};pts.forEach((j,i)=>{if(!(j.town in groups))return;const q=Tf(raw[i]);(bc[j.town] ||= {x:0,y:0,n:0});bc[j.town].x+=q[0];bc[j.town].y+=q[1];bc[j.town].n++});
  g.font='600 11px "IBM Plex Mono", monospace';g.textAlign='center';
  Object.entries(bc).forEach(([k,v])=>{const x=v.x/v.n,y=v.y/v.n+20;const w=g.measureText(k).width+12;g.fillStyle='rgba(18,22,28,.85)';g.fillRect(x-w/2,y-12,w,18);g.fillStyle='#e8ecf1';g.fillText(k,x,y+1)});
}
function hitAt(ev){const r=$('#map').getBoundingClientRect();const x=ev.clientX-r.left,y=ev.clientY-r.top;let best=null,bd=9;hits.forEach(h=>{const dx=Math.abs(h.x-x);if(dx<bd&&y>=h.y0-4&&y<=h.y1+4){bd=dx;best=h}});return best}

function refresh(){compute();ticker();route()}
function route(){
  const h=(location.hash||'#home').slice(1);
  const v=h.startsWith('job-')?'job':(['home','call-list','jobs','towns','how'].includes(h)?h:'home');
  document.querySelectorAll('.view').forEach(e=>e.classList.add('hide'));
  $('#v-'+v).classList.remove('hide');
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='home')home();if(v==='call-list')callList();if(v==='jobs')allJobs();if(v==='towns')towns();if(v==='how')shareTable();if(v==='job')jobView(h.slice(4));
}
function init(){
  [...new Set(jobs.map(j=>j.town))].sort().forEach(b=>$('#f-b').insertAdjacentHTML('beforeend',`<option>${esc(b)}</option>`));
  [...new Set(jobs.map(j=>j.use))].sort().forEach(s=>$('#f-s').insertAdjacentHTML('beforeend',`<option>${esc(s)}</option>`));
  ['#f-q','#f-b','#f-s','#f-c'].forEach(s=>$(s).addEventListener('input',allJobs));
  tradebar();assumeControls();
  const cv=$('#map');
  cv.addEventListener('mousemove',e=>{const h=hitAt(e);cv.style.cursor=h?'pointer':'crosshair';$('#map-hint').textContent=h?`${h.j.name}, ${h.j.town} · ${h.j.sqfa?fmtN(h.j.sqfa)+' sq ft':'site work'} · ${h.j.kind.t}`:'Bar height is floor area. Click a bar to open the project.'});
  cv.addEventListener('click',e=>{const h=hitAt(e);if(h)location.hash='job-'+h.j.id});
  window.addEventListener('resize',()=>{if(!$('#v-home').classList.contains('hide'))drawMap()});
  window.addEventListener('hashchange',route);
  refresh();
}
init();
