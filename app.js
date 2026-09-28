// ===================== CONFIG & STATE =====================
const DEFAULT_CFG={toteL:23.5,toteW:14,toteH:11,toteVol:3600,maxFill:0.90,maxToteLb:50,toteTare:0,cartSize:5,leadDays:1,
 payload:2877,maxTotes:90,volPerTote:187.5/90,costPerHour:1500,speedMph:170,groundMin:30,turnMin:45,firstDeparture:'08:00',maxStops:3,blockHours:2.49,priority:'oldest',
 cabinLen:198,cabinW:64,cabinH:54,rows:7,cols:4,levels:4,outerLevels:3,blocked:8,toteOutL:25,toteOutW:15.5,toteOutH:12};
const STATUSES=['Entered','Submitted','Picking','Picked','Loaded','Delivered'];
const S={cfg:{...DEFAULT_CFG},mode:'desk',oos:{},pk:{cart:null,aisle:null,review:false},orders:new Map(),community:'Webequie',communities:{},depsInput:[],plan:null,status:{},picks:{},
 edited:false,tab:'entry',pickDep:0,pickView:'overview',flightView:'routes',cartSel:0,flightDep:0,filter:'all',search:'',open:null,handheld:false,
 cellSel:null,dataset:'',stages:[],stageIdx:0,pendingFlights:null,flightsName:'',notes:[],sig:''};
const PRODUCTS=new Map(); (DATA.products||[]).forEach(p=>PRODUCTS.set(String(p[0]),p));

// ===================== UTIL =====================
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f1=n=>(Math.round(n*10)/10).toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1});
const f0=n=>Math.round(n).toLocaleString();
const pct=n=>Math.round(n*100)+'%';
const pad=(n,k=2)=>String(n).padStart(k,'0');
const dUTC=s=>{const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return Date.UTC(y,(m||1)-1,d||1)};
const daysBetween=(a,b)=>Math.round((dUTC(b)-dUTC(a))/864e5);
const addDays=(s,n)=>new Date(dUTC(s)+n*864e5).toISOString().slice(0,10);
const fmtDate=s=>{try{return new Date(dUTC(s)).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}catch(e){return s}};
const capV=()=>S.cfg.toteVol*S.cfg.maxFill;
const capW=()=>S.cfg.maxToteLb;
const sc=x=>Math.max(x.vol/capV(),x.w/capW());
function toast(msg,kind){const t=$('#toast');t.textContent=msg;t.classList.toggle('err',kind==='err');t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),kind==='err'?6000:2600)}

// ===================== AISLES (store walk order) =====================
const AISLES=['Produce','Bakery','Deli','Meat and seafood','Dairy and eggs','Pantry','Breakfast and cereal','Snacks and sweets','Beverages','Household','Health and personal care','Baby and pet','Frozen','Other'];
const AISLE_RULES=[
 ['Baby and pet',/\b(baby|babies|diapers?|infant|toddler|wipes|cat|cats|dog|dogs|kitten|puppy|litter|pet)\b/],
 ['Health and personal care',/(deodorant|antiperspirant|shampoo|conditioner|toothpaste|toothbrush|razor|soap|lotion|eye drops|vitamin|tablets|capsules|bandage|sunscreen|floss|mouthwash|body wash|lip balm|pain reliever|allergy|cotton|shave|shaving|ibuprofen|acetaminophen|multivitamin|supplement|probiotic capsules|face wash|cleanser|moisturiz)/],
 ['Household',/(dish liquid|dish soap|dishwasher|detergent|laundry|paper towel|toilet|tissue|facial tissue|food wrap|cling wrap|aluminum foil|\bfoil\b|trash|garbage|sponge|cleaner|bleach|disinfect|napkin|batteries|candle|fabric softener|storage bags|zipper bags|sandwich bags|plates|cups\b)/],
 ['Health and personal care',/(\bpads\b|tampons|\bspf\b|sun defense|liners)/],
 ['Household',/(dishwashing|coffee filters|freezer bags|slider bags|scrap bag|gloves|refills|sweeper|air freshener|febreze)/],
 ['Frozen',/(nuggets|hash browns|\bfries\b|curly fries|veggie burger|\bpizza\b(?!.*(snack|cracker|crisps|chips))|ice cream|gelato|frozen|sorbet|popsicle|fruit pops|ice pops|\bpops\b|frozen yogurt|waffles|tater tots|french fries)/],
 ['Snacks and sweets',/(chips|crackers?|crisps|pretzels?|cookies?|popcorn|veggie straws|\bpuffs\b|twirls|wafers?|snack stacks|fruit snacks|cup cakes)/],
 ['Pantry',/(\bdried\b|tomato paste|diced tomatoes|crushed tomatoes|stewed tomatoes|tomato sauce|fruit horns|preserves|\bjam\b|jelly|marmalade|pesto|ravioli|tortellini|gnocchi|applesauce|apple sauce|macaroni|mac & cheese|baked beans|chick peas|garbanzo|\bbase\b|bouillon|slices in|in 100%|canned|fettuccine|rotini|tortellini bowls|noodle cup|agave|bay leaves|liquid smoke|\bchili\b|decors|sprinkles|hearts of palm|peanut butter|nut butter|almond butter|\bspread\b|cream of|\bsoups?\b|broth|stock\b|\bsauce\b|marinade|dressing|minced garlic|jalapeno|olives|pickles|ketchup|mustard|mayo|mayonnaise|salsa verde)/],
 ['Dairy and eggs',/creamer/],
 ['Beverages',/(\bwater\b|soda|seltzer|\bcoke\b|\bcola\b|pepsi|tequila|pinot|vodka|whiskey|\brum\b|chardonnay|cabernet|merlot|yerba|\bmate\b|cocoa mix|hot cocoa|ginger ale|\bbeer\b|\bwine\b|kombucha|lemonade|iced coffee|juice|\btea\b|\bcoffee\b|espresso|energy drink|sports drink|sparkling|\bdrink\b|smoothie|beverage bottles|beer bottles)/],
 ['Dairy and eggs',/(provolone|whipped topping|milk|yogurt|yoghurt|kefir|skyr|cheese|\bbutter\b|sour cream|\bcream\b|\beggs?\b|cottage|half and half|half & half|margarine|ghee|almond breeze|string cheese|mozzarella|parmesan|cheddar|brie|feta)/],
 ['Snacks and sweets',/(jerky|energy bar|protein bar|granola bar|\bbars?\b|zbars|rice cakes?|trail mix)/],
 ['Deli',/(hommus|coleslaw|tofu|korma|masala|curry|hummus|salsa|pico de gallo|guacamole|samosa|meatloaf|\bdip\b|prepared|sandwich|sushi|rotisserie|lunchable|tabbouleh)/],
 ['Meat and seafood',/(salame|soppressata|claws|chicken|beef|pork|turkey|bacon|sausage|\bham\b|steak|salmon|shrimp|\bfish\b|cod\b|tilapia|meatballs?|prosciutto|salami|pepperoni|\blamb\b|hot dogs?|franks|ground (beef|turkey|chicken)|fillets?|scallops|crab|lobster|chorizo)/],
 ['Pantry',/(cake mix|pancake mix|baking|flour|\bsugar\b|brownie mix|frosting|extract|yeast|cocoa powder|protein powder|chocolate chips)/],
 ['Breakfast and cereal',/(cereal|oatmeal|granola|\boats\b|bran\b|clusters|toaster pastr|pancake|syrup|oat crunch|morning|muesli|cheerios|flakes|pop-tarts)/],
 ['Bakery',/(bread|\bloaf\b|zingers|\bcakes\b|bagels?|muffins?|croissant|tortillas?|\bbuns?\b|\brolls?\b|challah|pita|naan|donuts?|doughnuts?|cookie tray|\bcake\b|cupcakes?|\bpie\b|baguette|english muffin|brioche|sourdough)/],
 ['Snacks and sweets',/(chips|crackers|popcorn|popped|pretzels?|cookies?|nuts\b|almonds|cashews?|macadamias?|walnuts|pecans|pistachios|peanuts|candy|chocolate|gummy|gummies|licorice|snack|fruit leather|marshmallow|caramel|mints|wafers?|puffs|poppycock|pudding)/],
 ['Produce',/(apples?\b|bananas?|berries|berry|blueberr|strawberr|raspberr|blackberr|lettuce|kale|spinach|tomato|potato|onions?|garlic|peppers?\b|cucumbers?|carrots?|celery|squash|pumpkin|beets?\b|avocados?|limes?\b|lemons?\b|oranges?\b|grapes?\b|melon|pineapple|pomegranate|herbs?|basil|parsley|\bdill\b|cilantro|\bmint\b|salad|greens|broccoli|cauliflower|zucchini|mushrooms?|asparagus|\bcorn\b|peach|pears?\b|plums?\b|cherr|mango|kiwi|ginger|fruit|arugula|cabbage|radish|leeks?|scallions|shallots?|eggplant|yams?|clementines?|tangerines?|nectarines?|apricots?|figs?\b|dates\b|sprouts|romaine|chard|bok choy|fennel|artichoke|green beans|snap peas|papaya|okra|watercress|spring mix|edamame|turmeric|arancita|rossa|mache|rosettes|thyme|rosemary|sage\b|chives|jalape)/],
 ['Pantry',/(pasta|spaghetti|fusilli|penne|macaroni|noodles|\brice\b|quinoa|beans|lentils|\boil\b|vinegar|spray|spice|seasoning|\bsalt\b|black pepper|honey|jam|jelly|preserves|canned|tomato paste|crushed|diced|couscous|oregano|cinnamon|paprika|cumin|curry|tahini|soy|teriyaki|sriracha|hot sauce|bouillon|coconut|nutella|raisins|dried|seeds|flax|chia)/]
];
function aisleOf(name,given){if(given)return given;const n=String(name).toLowerCase();for(const [a,re] of AISLE_RULES)if(re.test(n))return a;return 'Other'}
const aisleRank=a=>{const i=AISLES.indexOf(a);return i<0?AISLES.length:i};

// ===================== CSV =====================
function parseCSV(text){const rows=[];let row=[],f='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c=='"'){if(text[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
  else if(c=='"')q=true; else if(c==','){row.push(f);f=''} else if(c=='\n'){row.push(f);rows.push(row);row=[];f=''} else if(c!='\r')f+=c}
 if(f!==''||row.length){row.push(f);rows.push(row)}
 return rows.filter(r=>r.some(x=>String(x).trim()!==''))}
const normH=h=>String(h).trim().toLowerCase().replace(/^\ufeff/,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const SYN={order_id:['order_id','orderid','order','order_number','order_no'],household_id:['household_id','household','customer_id','customer','hh','household_no'],
 product_id:['product_id','productid','sku','item_id','upc'],product_name:['product_name','item_name','item','product','name','description'],
 weight_lb:['weight_lb','weight_lbs','weight','wt_lb','wt'],length_in:['length_in','length','len','l'],width_in:['width_in','width','w'],height_in:['height_in','height','h','depth'],
 order_date:['order_date','date','ordered_on'],batch_id:['batch_id','batch'],destination_community:['destination_community','community','destination','dest'],quantity:['quantity','qty','count','units'],aisle:['aisle','department','dept','category','aisle_name','section']};
function mapCols(hdr,syn){const m={};for(const k in syn){const i=hdr.findIndex(h=>syn[k].includes(h));if(i>=0)m[k]=i}return m}

function loadOrdersText(text,name){
 const rows=parseCSV(text); if(rows.length<2) throw new Error('The file has no data rows.');
 const hdr=rows[0].map(normH), m=mapCols(hdr,SYN);
 if(m.order_id==null) throw new Error('No order ID column found. Expected a column like "order_id".');
 if(m.product_name==null&&m.product_id==null) throw new Error('No product column found. Expected "product_name" or "product_id".');
 const orders=new Map(), notes=[]; let filled=0, missing=0, idx=0; const comms={};
 for(const r of rows.slice(1)){
  const g=k=>m[k]!=null?String(r[m[k]]??'').trim():'';
  const oid=g('order_id'); if(!oid) continue;
  const pid=g('product_id'); let name=g('product_name');
  let w=parseFloat(g('weight_lb')),l=parseFloat(g('length_in')),wd=parseFloat(g('width_in')),h=parseFloat(g('height_in'));
  if([w,l,wd,h].some(v=>!(v>0))){const p=PRODUCTS.get(pid);
   if(p){if(!(l>0))l=p[2];if(!(wd>0))wd=p[3];if(!(h>0))h=p[4];if(!(w>0))w=p[5];if(!name)name=p[1];filled++}
   else{missing++; if(!(w>0))w=1; if(!(l>0))l=6; if(!(wd>0))wd=6; if(!(h>0))h=6;}}
  const qty=Math.max(1,parseInt(g('quantity'))||1);
  const comm=canonComm(g('destination_community')||'Webequie'); comms[comm]=(comms[comm]||0);
  const date=g('order_date')||new Date().toISOString().slice(0,10);
  if(!orders.has(oid)){orders.set(oid,{id:oid,hh:g('household_id')||oid,date,batch:g('batch_id')||'1',community:comm,items:[],w:0,vol:0});comms[comm]++}
  const o=orders.get(oid);
  for(let k=0;k<qty;k++){const it={idx:idx++,orderId:oid,pid:pid||name,name:name||('Product '+pid),w,l,wd,h,vol:l*wd*h,aisle:aisleOf(name||'',g('aisle'))};o.items.push(it);o.w+=w;o.vol+=it.vol}
 }
 if(!orders.size) throw new Error('No orders found in the file.');
 if(filled) notes.push(`${filled} item rows had missing size or weight and were filled from the product reference list.`);
 if(missing) notes.push(`${missing} item rows had missing size or weight and no match in the product reference; defaults were used (1 lb, 6×6×6 in). Check these items.`);
 S.orders=orders; S.communities=comms; S.community=comms.Webequie!=null?'Webequie':Object.keys(comms)[0];
 const others=Object.entries(comms).filter(([c])=>c!==S.community).reduce((a,[,n])=>a+n,0);

 const ids=[...orders.keys()]; S.sig=name+'|'+ids.length+'|'+ids[0]+'|'+ids[ids.length-1];
 S.dataset=name; S.notes=notes; S.status={}; S.picks={}; S.oos={}; S.pk={cart:null,aisle:null,review:false};
 for(const o of orders.values()){S.status[o.id]='Entered';
  for(const it of o.items){if(!itemFits(it)) notes.push(`"${it.name}" in order ${o.id} is larger than a tote in every orientation. It is packed alone and flagged.`)}}
 restore();
}
function loadFlightsText(text,name){
 const rows=parseCSV(text); const hdr=rows[0].map(normH);
 const m=mapCols(hdr,{id:['departure_id','flight_id','id','departure'],date:['departure_date','date','flight_date'],totes:['available_totes','totes','max_totes'],payload:['available_payload_lb','payload_lb','payload','available_payload'],vol:['available_volume_cuft','volume_cuft','volume','available_volume']});
 if(m.date==null||m.payload==null) throw new Error('Flight file needs at least departure_date and available_payload_lb columns.');
 S.depsInput=rows.slice(1).map((r,i)=>{const totes=parseInt(r[m.totes])||S.cfg.maxTotes;return{id:r[m.id]||String(i+1),date:String(r[m.date]).trim(),totes,payload:parseFloat(r[m.payload]),vol:parseFloat(r[m.vol])||totes*S.cfg.volPerTote}}).sort((a,b)=>dUTC(a.date)-dUTC(b.date));
 S.flightsName=name;
}

// ===================== PACKING =====================
function itemFits(it){const a=[it.l,it.wd,it.h].sort((x,y)=>y-x),b=[S.cfg.toteL,S.cfg.toteW,S.cfg.toteH].sort((x,y)=>y-x);return a.every((v,i)=>v<=b[i]+1e-9)}
function makeChunks(o){
 const CV=capV(),CW=capW();
 if(o.vol<=CV&&o.w<=CW) return [{orderId:o.id,hh:o.hh,items:o.items.slice(),w:o.w,vol:o.vol}];
 const its=o.items.slice().sort((a,b)=>sc(b)-sc(a)), bins=[];
 for(const it of its){let best=null,bs=-1;
  if(itemFits(it)) for(const b of bins){if(b.vol+it.vol<=CV+1e-9&&b.w+it.w<=CW+1e-9){const s=Math.max((b.vol+it.vol)/CV,(b.w+it.w)/CW);if(s>bs){bs=s;best=b}}}
  if(!best){best={orderId:o.id,hh:o.hh,items:[],w:0,vol:0};bins.push(best)}
  best.items.push(it);best.w+=it.w;best.vol+=it.vol}
 return bins}
function addBag(t,c){const ex=t.bags.find(b=>b.orderId===c.orderId);
 if(ex){ex.items=ex.items.concat(c.items);ex.w+=c.w;ex.vol+=c.vol}else t.bags.push({orderId:c.orderId,hh:c.hh,items:c.items.slice(),w:c.w,vol:c.vol});
 t.w+=c.w;t.vol+=c.vol}
function packChunks(chunks,improve){
 const CV=capV(),CW=capW(),totes=[];
 for(const c of chunks.slice().sort((a,b)=>sc(b)-sc(a))){let best=null,bs=-1;
  const solo=c.items.some(it=>!itemFits(it));
  if(!solo) for(const t of totes){if(t.solo)continue;if(t.vol+c.vol<=CV+1e-9&&t.w+c.w<=CW+1e-9){const s=Math.max((t.vol+c.vol)/CV,(t.w+c.w)/CW);if(s>bs){bs=s;best=t}}}
  if(!best){best={bags:[],w:0,vol:0,solo};totes.push(best)}
  addBag(best,c)}
 if(improve) compact(totes,CV,CW);
 return totes}
function compact(totes,CV,CW){let changed=true,guard=0;
 while(changed&&guard++<300){changed=false;
  for(const t of totes.slice().sort((a,b)=>sc(a)-sc(b))){if(t.solo)continue;
   const clones=totes.filter(x=>x!==t&&!x.solo).map(o=>({o,w:o.w,vol:o.vol,add:[]}));let ok=true;
   for(const b of t.bags.slice().sort((a,b)=>sc(b)-sc(a))){let best=null,bs=-1;
    for(const c of clones){if(c.vol+b.vol<=CV+1e-9&&c.w+b.w<=CW+1e-9){const s=Math.max((c.vol+b.vol)/CV,(c.w+b.w)/CW);if(s>bs){bs=s;best=c}}}
    if(!best){ok=false;break} best.vol+=b.vol;best.w+=b.w;best.add.push(b)}
   if(ok){for(const c of clones)for(const b of c.add)addBag(c.o,b);totes.splice(totes.indexOf(t),1);changed=true;break}}}}
function depWeight(totes){return totes.reduce((a,t)=>a+t.w,0)+totes.length*S.cfg.toteTare}
function levelsAt(c){const C=S.cfg;return (c===0||c===C.cols-1)&&C.cols>2?Math.min(C.levels,C.outerLevels??C.levels):C.levels}
function cabinSlots(){const C=S.cfg;let n=0;for(let c=0;c<C.cols;c++)n+=levelsAt(c);return C.rows*n-C.blocked}
function fitsDep(totes,d){const n=totes.length;return n<=d.totes&&n<=cabinSlots()&&depWeight(totes)<=d.payload+1e-9&&n*S.cfg.volPerTote<=d.vol+1e-6}

// ===================== PLANNING =====================

// ===================== ROUTES (bonus: three communities out of Nakina) =====================
const HUB={code:'CYQN',name:'Nakina',lat:50.1828,lon:-86.6964};
const LOW_OP_WEIGHT=3923;
const DEST=[
 {community:'Webequie',code:'CYWP',airport:'Webequie',lat:52.9594,lon:-87.3749,nm:169,fuel:1046,payload:2877,hours:2.49,alias:['webequie']},
 {community:'Summer Beaver',code:'CJV7',airport:'Summer Beaver',lat:52.7086,lon:-88.5419,nm:167,fuel:1036,payload:2887,hours:2.46,alias:['summer beaver','nibinamik']},
 {community:'Neskantaga',code:'CYLH',airport:'Landsdowne House',lat:52.1956,lon:-87.9342,nm:130,fuel:861,payload:3062,hours:1.96,alias:['neskantaga','landsdowne house','lansdowne house']}];
function canonComm(n){const k=String(n||'').trim().toLowerCase();const d=DEST.find(x=>x.alias.includes(k));return d?d.community:String(n||'').trim()}
const destOf=c=>DEST.find(x=>x.community===c);
function gcNm(a,b){const R=3440.065,r=Math.PI/180;const dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;const h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
// Fuel model fitted to the sponsor's three routes: fuel = FIX + PER x flight hours (reproduces each within about 1 lb); flight hours include time for every take-off and landing
const FUEL=(()=>{const xs=DEST.map(d=>d.hours),ys=DEST.map(d=>d.fuel);const n=xs.length,mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
 const per=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);return {fix:my-per*mx,per}})();
const LEG_H=DEST.reduce((a,d)=>a+(d.hours-d.nm*1.15078*2/170)/2,0)/DEST.length; // time per take-off and landing implied by the sponsor's figures
function legNm(a,b){if(a.code===HUB.code&&b.nm)return b.nm;if(b.code===HUB.code&&a.nm)return a.nm;return gcNm(a,b)}
function routeFor(stops){const pts=[HUB,...stops.map(destOf),HUB];const legs=[];for(let i=0;i<pts.length-1;i++)legs.push({from:pts[i],to:pts[i+1],nm:legNm(pts[i],pts[i+1])});
 const nm=legs.reduce((a,l)=>a+l.nm,0),sm=nm*1.15078;const single=stops.length===1;const d0=destOf(stops[0]);const hours=single&&S.cfg.speedMph===170?d0.hours:sm/S.cfg.speedMph+LEG_H*legs.length;
 const fuel=single?d0.fuel:FUEL.fix+FUEL.per*hours;const payload=single?d0.payload:LOW_OP_WEIGHT-fuel;
 return {stops,legs,nm,sm,hours,fuel,payload,codes:[HUB.code,...stops.map(c=>destOf(c).code),HUB.code],single}}
function perms(a){if(a.length<2)return [a];return a.flatMap((x,i)=>perms(a.filter((_,j)=>j!==i)).map(p=>[x,...p]))}
function bestRoute(g,hh){return perms(g).map(p=>routeFor(p)).sort((a,b)=>a.nm-b.nm||(hh[b.stops[0]]||0)-(hh[a.stops[0]]||0))[0]}
function partitions(a){if(!a.length)return [[]];const [f,...r]=a;const out=[];for(const p of partitions(r)){out.push([[f],...p]);p.forEach((g,i)=>out.push(p.map((x,j)=>j===i?[f,...x]:x)))}return out}
const maxT=()=>Math.min(S.cfg.maxTotes,cabinSlots());
function fitsCap(t,payload){return t.length<=maxT()&&depWeight(t)<=payload+1e-9}
function routeMode(){return !S.depsInput.length}
function hhm(h){const m=Math.round(h*60);return `${Math.floor(m/60)} h ${pad(m%60)} min`}
function clock(mins){mins=Math.round(mins);return `${pad(Math.floor(mins/60)%24)}:${pad(mins%60)}`}
function runRoutePlan(){
 const all=currentOrders();const known=all.filter(o=>destOf(o.community)),unk=all.filter(o=>!destOf(o.community));
 S.notes=(S.notes||[]).filter(n=>!n.startsWith('Held back:'));if(unk.length){const cs=[...new Set(unk.map(o=>o.community))];S.notes.push(`Held back: ${unk.length} ${unk.length===1?'order':'orders'} for ${cs.join(', ')}, which has no route out of Nakina. See Flight management, Not planned.`)}
 const comms=[...new Set(known.map(o=>o.community))].sort((a,b)=>DEST.findIndex(d=>d.community===a)-DEST.findIndex(d=>d.community===b));
 const cache=new Map();known.forEach(o=>cache.set(o.id,makeChunks(o)));
 const byC={},packC={},hh={};comms.forEach(c=>{byC[c]=known.filter(o=>o.community===c);packC[c]=packChunks(byC[c].flatMap(o=>cache.get(o.id)),true);hh[c]=new Set(byC[c].map(o=>o.hh)).size});
 const fillFlights=(os,r)=>{let rem=os.slice().sort((a,b)=>b.w-a.w);const out=[];
  while(rem.length){let sel=[],ch=[];const next=[];
   for(const o of rem){const trial=ch.concat(cache.get(o.id));let t=packChunks(trial,false);if(!fitsCap(t,r.payload))t=packChunks(trial,true);if(fitsCap(t,r.payload)){sel.push(o);ch=trial}else next.push(o)}
   if(!sel.length){sel=[next.shift()];ch=cache.get(sel[0].id)}out.push({route:r,orders:sel,totes:packChunks(ch,true)});rem=next}return out};
 const evalGroup=g=>{const r=bestRoute(g,hh);
  if(g.length===1){const t=packC[g[0]];if(fitsCap(t,r.payload))return {ok:true,flights:[{route:r,orders:byC[g[0]],totes:t}]};return {ok:true,flights:fillFlights(byC[g[0]],r)}}
  const t=g.flatMap(c=>packC[c]);const w=depWeight(t);const ok=fitsCap(t,r.payload);
  return {ok,flights:ok?[{route:r,orders:g.flatMap(c=>byC[c]),totes:t}]:[],why:ok?'':(t.length>maxT()?`${t.length} totes, over ${maxT()}`:`${f0(w)} lb, over ${f0(r.payload)} lb`)}};
 const cost=h=>h*S.cfg.costPerHour;
 const options=partitions(comms).filter(p=>p.every(g=>g.length<=S.cfg.maxStops)).map(p=>{const ev=p.map(evalGroup);const ok=ev.every(e=>e.ok);const fl=ev.flatMap(e=>e.flights);
  const hours=fl.reduce((a,f)=>a+f.route.hours,0),fuel=fl.reduce((a,f)=>a+f.route.fuel,0);
  return {key:p.map(g=>g.slice().sort().join('+')).sort().join(' | '),groups:p,ok,flights:fl,hours,fuel,cost:cost(hours),n:fl.length,why:ev.filter(e=>!e.ok).map(e=>e.why).join('; ')}})
  .sort((a,b)=>(b.ok-a.ok)||a.hours-b.hours||a.n-b.n);
 const pairs=[];for(let i=0;i<comms.length;i++)for(let j=i+1;j<comms.length;j++){const a=comms[i],b=comms[j];const sa=evalGroup([a]),sb=evalGroup([b]),cb=evalGroup([a,b]);const sep=[...sa.flights,...sb.flights];const r=bestRoute([a,b],hh);const t=[...packC[a],...packC[b]];
  pairs.push({a,b,sepHours:sep.reduce((x,f)=>x+f.route.hours,0),sepFuel:sep.reduce((x,f)=>x+f.route.fuel,0),sepN:sep.length,route:r,cargo:depWeight(t),totes:t.length,ok:cb.ok,why:cb.why})}
 const chosen=(S.planChoice&&options.find(o=>o.key===S.planChoice&&o.ok))||options.find(o=>o.ok)||options[0];
 const perHour=f=>new Set(f.orders.map(o=>o.hh)).size/f.route.hours;
 const seq=chosen?chosen.flights.slice().sort((a,b)=>perHour(b)-perHour(a)):[];
 const [hS,mS]=String(S.cfg.firstDeparture||'08:00').split(':').map(Number);let t=(hS||8)*60+(mS||0);
 const date=(all.map(o=>o.date).sort().pop())||new Date().toISOString().slice(0,10);
 const deps=seq.map((f,i)=>{const r=f.route;const dep=t;let at=dep;const stopTimes=[];
  r.legs.forEach((l,k)=>{at+=(l.nm*1.15078/S.cfg.speedMph+LEG_H)*60;if(k<r.legs.length-1){stopTimes.push({code:l.to.code,name:l.to.community,arr:at});at+=S.cfg.groundMin}});
  const ret=at;t=ret+S.cfg.turnMin;const totes=maxT();
  const d={id:String(i+1),n:i+1,code:'F'+(i+1),date,depTime:clock(dep),retTime:clock(ret),stopTimes,route:r,stops:r.stops,totes,payload:r.payload,vol:totes*S.cfg.volPerTote,totes_:f.totes.map(x=>({...x,bags:x.bags.map(b=>({...b,items:b.items.slice()}))})),orders:f.orders};finalizeDep(d);return d});
 const assign={};deps.forEach(d=>d.orderIds.forEach(o=>assign[o]=d.n));
 S.plan={deps,assign,skipped:{},unassigned:unk,routeMode:true,options,pairs,chosen,comms,hh,packC,base:options.find(o=>o.groups.every(g=>g.length===1))};S.edited=false;
 S.pickDep=Math.min(S.pickDep,Math.max(0,deps.length-1));S.flightDep=Math.min(S.flightDep,Math.max(0,deps.length-1));S.cartSel=0;S.cellSel=null;
}
function depWhen(d){return d.depTime?`${d.depTime} departure`:fmtDate(d.date)}
function stopsLabel(d){return d.stops?d.stops.join(' → '):'Webequie'}
function toteComm(t){const o=S.orders.get(t.bags[0]?.orderId);return o?o.community:''}

function currentOrders(){return [...S.orders.values()].filter(o=>routeMode()||o.community===S.community).sort((a,b)=>dUTC(a.date)-dUTC(b.date)||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}))}
function defaultDeps(os){const last=os.reduce((m,o)=>o.date>m?o.date:m,os[0]?.date||'2026-01-01');
 return [{id:'1',date:addDays(last,S.cfg.leadDays),totes:S.cfg.maxTotes,payload:S.cfg.payload,vol:S.cfg.maxTotes*S.cfg.volPerTote,auto:true}]}
function runPlan(){
 if(routeMode()){runRoutePlan();return}
 const os=currentOrders(); const deps=(S.depsInput.length?S.depsInput:defaultDeps(os)).map((d,i)=>({...d,code:'F'+(i+1),n:i+1}));
 const chunkCache=new Map(); os.forEach(o=>chunkCache.set(o.id,makeChunks(o)));
 const scoreO=o=>chunkCache.get(o.id).length+Math.max(o.vol/capV(),o.w/capW());
 let pending=os.slice(); const assign={}, skipped={};
 for(const d of deps){
  let elig=pending.filter(o=>daysBetween(o.date,d.date)>=S.cfg.leadDays);
  if(S.cfg.priority==='oldest') elig.sort((a,b)=>dUTC(a.date)-dUTC(b.date)||scoreO(a)-scoreO(b));
  else if(S.cfg.priority==='most') elig.sort((a,b)=>scoreO(a)-scoreO(b));
  else elig.sort((a,b)=>dUTC(a.date)-dUTC(b.date)||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
  let sel=[],selChunks=[];
  for(const o of elig){const trial=selChunks.concat(chunkCache.get(o.id));
   let t=packChunks(trial,false); if(!fitsDep(t,d)) t=packChunks(trial,true);
   if(fitsDep(t,d)){sel.push(o);selChunks=trial} else (skipped[o.id]=skipped[o.id]||[]).push(d.n)}
  d.orders=sel; d.totes_=packChunks(selChunks,true); sel.forEach(o=>assign[o.id]=d.n);
  const selSet=new Set(sel.map(o=>o.id)); pending=pending.filter(o=>!selSet.has(o.id));
  finalizeDep(d)}
 S.plan={deps,assign,skipped,unassigned:pending}; S.edited=false;
 S.pickDep=Math.min(S.pickDep,deps.length-1); S.flightDep=Math.min(S.flightDep,deps.length-1); S.cartSel=0; S.cellSel=null;
}
function finalizeDep(d){
 const totes=d.totes_.filter(t=>t.bags.length);
 totes.forEach(t=>{t.w=t.bags.reduce((a,b)=>a+b.w,0);t.vol=t.bags.reduce((a,b)=>a+b.vol,0)});
 // carts: keep all totes of a split order on one cart
 const par=totes.map((_,i)=>i),find=i=>par[i]===i?i:(par[i]=find(par[i])),first={};
 totes.forEach((t,i)=>t.bags.forEach(b=>{if(first[b.orderId]!=null)par[find(i)]=find(first[b.orderId]);else first[b.orderId]=i}));
 const groups={};totes.forEach((t,i)=>(groups[find(i)]=groups[find(i)]||[]).push(t));
 const comps=Object.values(groups).sort((a,b)=>toteComm(a[0]).localeCompare(toteComm(b[0]))||b.length-a.length);const size=Math.max(1,S.cfg.cartSize),carts=[];
 for(const c of comps){c.sort((a,b)=>b.w-a.w);
  if(c.length>size){for(let i=0;i<c.length;i+=size)carts.push({totes:c.slice(i,i+size),spill:true});continue}
  let best=null,room=1e9;for(const k of carts){const r=size-k.totes.length;if(toteComm(k.totes[0])===toteComm(c[0])&&r>=c.length&&r<room){room=r;best=k}}
  if(best)best.totes.push(...c);else carts.push({totes:c.slice(),spill:false})}
 let n=0;d.carts=carts.map((k,i)=>({n:i+1,spill:k.spill,totes:k.totes}));
 d.totes_=[];for(const k of d.carts)for(const t of k.totes){n++;t.id=`${d.code}-T${pad(n)}`;t.cart=k.n;
  t.bags.sort((a,b)=>b.vol-a.vol);t.bags.forEach((b,j)=>{b.letter=String.fromCharCode(65+j);b.label=`${t.id}-${b.letter}`});d.totes_.push(t)}
 // bag part numbers
 const cnt={},seen={};d.totes_.forEach(t=>t.bags.forEach(b=>cnt[b.orderId]=(cnt[b.orderId]||0)+1));
 d.totes_.forEach(t=>t.bags.forEach(b=>{seen[b.orderId]=(seen[b.orderId]||0)+1;b.part=seen[b.orderId];b.parts=cnt[b.orderId]}));
 // cabin positions: heaviest on the floor, forward first
 const C=S.cfg,pos=[];for(let lv=0;lv<C.levels;lv++)for(let r=0;r<C.rows;r++)for(let c=0;c<C.cols;c++)if(lv<levelsAt(c))pos.push({lv,r,c});
 const aft=pos.filter(p=>p.r===C.rows-1).sort((a,b)=>b.lv-a.lv||b.c-a.c).slice(0,C.blocked);const bl=new Set(aft);
 const usable=pos.filter(p=>!bl.has(p));d.blockedPos=aft;
 d.totes_.forEach(t=>t.pos=null);
 if(d.stops&&d.stops.length>1){const si=t=>d.stops.indexOf(toteComm(t));usable.sort((a,b)=>a.r-b.r||a.lv-b.lv||a.c-b.c);d.totes_.slice().sort((a,b)=>si(b)-si(a)||b.w-a.w).forEach((t,i)=>{t.pos=usable[i]||null})}
 else d.totes_.slice().sort((a,b)=>b.w-a.w).forEach((t,i)=>{t.pos=usable[i]||null});
 d.weight=depWeight(d.totes_);d.nT=d.totes_.length;d.volUsed=d.nT*C.volPerTote;
 d.orderIds=[...new Set(d.totes_.flatMap(t=>t.bags.map(b=>b.orderId)))];
 const ratios=[['Tote slots',d.nT/d.totes],['Weight',d.weight/d.payload],['Volume',d.volUsed/d.vol]];
 d.binding=ratios.sort((a,b)=>b[1]-a[1])[0];d.ok=fitsDep(d.totes_,d);
}
function toteOver(t){return t.vol>S.cfg.toteVol*1.0001||t.w>capW()+1e-9}

// ===================== STATUS & PICKS =====================
function storeKey(){return 'zamiigo:'+S.sig}
function save(){try{localStorage.setItem(storeKey(),JSON.stringify({status:S.status,picks:S.picks,oos:S.oos}))}catch(e){}}
function restore(){try{const v=JSON.parse(localStorage.getItem(storeKey())||'null');if(v){Object.assign(S.status,v.status||{});S.picks=v.picks||{};S.oos=v.oos||{}}}catch(e){}}
const rank=s=>STATUSES.indexOf(s);
function syncOrderPick(oid){const o=S.orders.get(oid);if(!o)return;const done=o.items.filter(it=>S.picks[it.idx]||S.oos[it.idx]).length;
 const st=S.status[oid];if(rank(st)>=rank('Loaded'))return;
 if(done===o.items.length)S.status[oid]='Picked';else if(done>0)S.status[oid]='Picking';else if(rank(st)>=rank('Picking'))S.status[oid]='Submitted'}
function setPick(idxs,val){const touched=new Set();for(const i of idxs){S.picks[i]=val;touched.add(itemOrder[i])}touched.forEach(syncOrderPick);save()}
let itemOrder={};function indexItems(){itemOrder={};for(const o of S.orders.values())for(const it of o.items)itemOrder[it.idx]=o.id}

// ===================== RETAILER ENTRY =====================
function groupedItems(o){const m=new Map();for(const it of o.items){const k=it.pid+'|'+it.name;if(!m.has(k))m.set(k,{pid:it.pid,name:it.name,qty:0,w:0});const g=m.get(k);g.qty++;g.w+=it.w}return [...m.values()]}
function retailerText(o){const g=groupedItems(o);
 return [`ZAMIIGO BATCH ${o.batch} / Customer account ZMG-HH${o.hh}`,`Order ${o.id} / placed ${o.date}`,`Deliver to: ${o.community} via Nakina (CYQN)`,'',
 'Qty  Product ID  Product',...g.map(x=>`${String(x.qty).padEnd(4)} ${String(x.pid).padEnd(11)} ${x.name}`),'',
 `Lines: ${g.length}  Items: ${o.items.length}  Est. weight: ${f1(o.w)} lb`,'Pack in own labelled bag. Keep separate receipt for Nutrition North subsidy.'].join('\n')}
function copyText(t){const fb=()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove()};
 if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast('Copied for the retailer site'),()=>{fb();toast('Copied for the retailer site')});else{fb();toast('Copied for the retailer site')}}
function download(name,text){const b=new Blob([text],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove()}
const csvq=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function exportRetailer(){const rows=[['batch_id','customer_account','order_id','household_id','product_id','product_name','quantity','status','flight']];
 for(const o of currentOrders())for(const g of groupedItems(o))rows.push([o.batch,'ZMG-HH'+o.hh,o.id,o.hh,g.pid,g.name,g.qty,S.status[o.id],flightLabel(o.id)]);
 download('zamiigo_retailer_entries.csv',rows.map(r=>r.map(csvq).join(',')).join('\n'))}
function flightLabel(oid){const n=S.plan?.assign[oid];if(!n)return 'Not scheduled';const d=S.plan.deps[n-1];return d.depTime?`Flight ${n} (${d.depTime})`:`Flight ${n} (${fmtDate(d.date)})`}


// ===================== UI HELPERS =====================
const IC={clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
 cart:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
 plane:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
 scale:'<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 flow:'<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h9"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
 roll:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
 fill:'<path d="M3 20h18"/><rect x="5" y="10" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="16" y="12" width="3" height="5" rx="1"/>',
 split:'<path d="M16 3h5v5M8 3H3v5M21 3l-7 7M3 3l7 7M12 22v-8"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'};
const ico=k=>`<svg class="i" viewBox="0 0 24 24">${IC[k]||IC.info}</svg>`;
function card(title,icon,body,o={}){return `<section class="card ${o.cls||''}"><div class="cardhead"><span class="cico">${ico(icon)}</span><div class="ct2"><h3>${title}</h3>${o.sub?`<p>${o.sub}</p>`:''}</div><span class="grow"></span>${o.actions||''}</div>${body}</section>`}
function tile(v,l,tone,icon){return `<div class="tile ${tone}"><span class="tico">${ico(icon)}</span><b>${v}</b><span>${l}</span></div>`}
function subnav(key,items){return `<div class="subnav" role="tablist">${items.map(([v,l])=>`<button role="tab" aria-selected="${S[key]===v}" data-a="sub" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`}


// ===================== PICKER MODE (handheld) =====================
function oosNote(o){const g=groupItemsIdx(o.items.filter(it=>S.oos[it.idx]));if(!g.length)return '';return `<p class="warnline">Out of stock: ${g.map(x=>esc(x.name)+(x.idx.length>1?' ×'+x.idx.length:'')).join(', ')}. Substitute or adjust this household's receipt.</p>`}
const handled=i=>!!(S.picks[i]||S.oos[i]);
function cartWalk(k){const walk=new Map();for(const t of k.totes)for(const b of t.bags)for(const it of b.items){const key=it.pid+'|'+it.name;
 if(!walk.has(key))walk.set(key,{key,name:it.name,pid:it.pid,w:it.w,aisle:it.aisle||'Other',drops:new Map(),idx:[]});const w=walk.get(key);w.idx.push(it.idx);
 const d=w.drops.get(b.label)||{n:0,hh:b.hh,idx:[]};d.n++;d.idx.push(it.idx);w.drops.set(b.label,d)}
 return [...walk.values()].sort((a,b)=>aisleRank(a.aisle)-aisleRank(b.aisle)||a.name.localeCompare(b.name))}
function cartAisles(walk){const m=new Map();for(const w of walk){if(!m.has(w.aisle))m.set(w.aisle,{name:w.aisle,items:[],n:0,done:0});const a=m.get(w.aisle);a.items.push(w);a.n+=w.idx.length;a.done+=w.idx.filter(handled).length}return [...m.values()]}
function cartProgress(k){const all=k.totes.flatMap(t=>t.bags.flatMap(b=>b.items.map(i=>i.idx)));return {n:all.length,done:all.filter(handled).length}}
function pkHeader(title,sub,right,prog){return `<header class="pkh"><div class="pkr"><div style="flex:1;min-width:0"><h1>${title}</h1><p>${sub}</p></div>${right}</div>${prog!=null?`<div class="pkbar"><i style="width:${Math.round(prog*100)}%"></i></div>`:''}</header>`}
function renderPicker(){
 if(!S.plan||!S.orders.size)return pkHeader('Nakina Link','Picker','<button class="lnk" data-a="mode" data-v="desk">Desktop</button>')+'<div class="pkbody"><p class="empty">No orders loaded yet. Ask a supervisor to load the batch.</p></div>';
 const d=S.plan.deps[S.pickDep];
 if(S.pk.cart==null||!d.carts[S.pk.cart])return pickerCarts(d);
 return pickerAisle(d,d.carts[S.pk.cart])}
function pickerCarts(d){const deps=S.plan.deps;
 const pills=deps.length>1?`<div class="subnav" role="tablist">${deps.map((x,i)=>`<button role="tab" aria-selected="${S.pickDep===i}" data-a="pkDep" data-v="${i}">Flight ${x.n}</button>`).join('')}</div>`:'';
 const cards=d.carts.map((k,i)=>{const p=cartProgress(k);const na=cartAisles(cartWalk(k)).length;const st=p.done===p.n?'<span class="s-done">Done</span>':p.done?'<span class="s-prog">In progress</span>':'<span class="s-new">Not started</span>';
  return `<button class="pkcart ${p.done&&p.done<p.n?'prog':''}" data-a="pkCart" data-v="${i}"><div class="top"><b>Cart ${k.n}</b>${st}</div><div class="sub">${k.totes.length} totes, ${p.n} items across ${na} aisles${p.done?`, ${p.done} picked`:''}</div>${bar(p.n?p.done/p.n:0,'progress')}</button>`}).join('');
 return pkHeader('Nakina Link',`Picker / Flight ${d.n}, ${depWhen(d)}`,'<button class="lnk" data-a="mode" data-v="desk">Desktop view</button>')+
 `<div class="pkbody">${pills}<div class="pklabel">Choose your cart</div>${cards||'<p class="empty">No carts on this flight.</p>'}</div>`}
function pickerAisle(d,k){const walk=cartWalk(k),aisles=cartAisles(walk),p=cartProgress(k);
 const head=pkHeader(`Cart ${k.n}`,`Flight ${d.n} / ${p.done} of ${p.n} items`,'<button class="lnk" data-a="pkBack">All carts</button>',p.n?p.done/p.n:0);
 if(p.done===p.n&&!S.pk.review){const oos=walk.filter(w=>w.idx.some(i=>S.oos[i]));
  return head+`<div class="pkbody"><div class="pkdone"><div class="big"><svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div><h2>Cart ${k.n} complete</h2>
  <p class="muted">${p.n-walk.reduce((a,w)=>a+w.idx.filter(i=>S.oos[i]).length,0)} items picked into ${k.totes.length} totes.</p>
  ${oos.length?`<p><strong>Out of stock</strong></p><ul>${oos.map(w=>`<li>${esc(w.name)}</li>`).join('')}</ul>`:''}
  <div class="pkact"><button class="pkbig" data-a="pkBack">Back to carts</button><button class="pkundo" data-a="pkReview">Review aisles</button></div></div></div>`}
 let cur=aisles.find(a=>a.name===S.pk.aisle);if(!cur){cur=aisles.find(a=>a.done<a.n)||aisles[0];S.pk.aisle=cur.name}
 const ci=aisles.indexOf(cur);const next=aisles.slice(ci+1).find(a=>a.done<a.n)||aisles.find(a=>a.done<a.n&&a!==cur);
 const chips=`<nav class="aislechips" aria-label="Aisles">${aisles.map((a,i)=>`<button class="achip ${a===cur?'on':''} ${a.done===a.n?'done':''}" data-a="pkAisle" data-v="${esc(a.name)}"><span class="anum">${i+1}</span>${esc(a.name)}<em>${a.done===a.n?'✓':a.n-a.done}</em></button>`).join('')}</nav>`;
 const rows=cur.items.map(w=>{const rem=w.idx.filter(i=>!handled(i)).length,isO=w.idx.every(i=>S.oos[i]),isP=!rem&&!isO;
  const drops=[...w.drops].map(([l,x])=>`<span class="dropb sm">${l.replace(/^F\d+-/,'')}${x.n>1?' ×'+x.n:''}<small>HH ${esc(x.hh)}</small></span>`).join('');
  return `<div class="pkrowi ${isP?'picked':''} ${isO?'isoos':''}"><button class="pktap" data-a="pkToggle" data-v="${w.idx.join(',')}" aria-pressed="${isP}">
   <span class="tick">${isP?'<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>':''}</span>
   <span class="pkinfo"><span class="pkq">×${w.idx.length}</span><b>${esc(w.name)}</b><span class="drops">${drops}</span></span></button>
   <button class="oosbtn" data-a="pkOos" data-v="${w.idx.join(',')}" aria-pressed="${isO}">${isO?'Out of stock':'Out?'}</button></div>`}).join('');
 const foot=cur.done<cur.n?`<button class="pkbig ghostbig" data-a="pkAll" data-v="${cur.items.flatMap(w=>w.idx.filter(i=>!handled(i))).join(',')}">Mark all ${cur.n-cur.done} in this aisle picked</button>`:'';
 return head+`<div class="pkbody">${chips}
  <div class="aislehead"><div><span class="muted small">Aisle stop ${ci+1} of ${aisles.length}</span><h2>${esc(cur.name)}</h2></div><span class="acount">${cur.done}/${cur.n}</span></div>
  <p class="muted small" style="margin:0 0 10px">Tap an item when it's in the cart. Tap again to undo.</p>
  <div class="pklist">${rows}</div>
  <div class="pkact">${next?`<button class="pkbig" data-a="pkAisle" data-v="${esc(next.name)}">Next aisle: ${esc(next.name)} (${next.n-next.done})</button>`:(p.done===p.n?'<button class="pkbig" data-a="pkFinish">Finish cart</button>':'')}${foot}</div></div>`}
function pkToggle(idxs){const all=idxs.every(handled);idxs.forEach(i=>{if(all){delete S.picks[i];delete S.oos[i]}else if(!handled(i))S.picks[i]=true});
 new Set(idxs.map(i=>itemOrder[i])).forEach(syncOrderPick);save();if(!all&&navigator.vibrate)try{navigator.vibrate(25)}catch(e){}}
function pkOosToggle(idxs){const all=idxs.every(i=>S.oos[i]);idxs.forEach(i=>{if(all)delete S.oos[i];else{S.oos[i]=true;delete S.picks[i]}});new Set(idxs.map(i=>itemOrder[i])).forEach(syncOrderPick);save()}
function pkScanNext(){const d=S.plan.deps[S.pickDep],k=d.carts[S.pk.cart];if(!k)return;const a=cartAisles(cartWalk(k)).find(x=>x.name===S.pk.aisle);if(!a)return;const w=a.items.find(x=>!x.idx.every(handled));if(w)pkToggle(w.idx)}

// ===================== BATCHES (each uploaded orders CSV is a batch) =====================
function saveStages(){try{localStorage.setItem('zamiigo:batches',JSON.stringify(S.stages));localStorage.setItem('zamiigo:active',String(S.stageIdx))}catch(e){}}
function initStages(){S.stages=[];try{const c=JSON.parse(localStorage.getItem('zamiigo:batches')||'[]');if(Array.isArray(c))S.stages=c}catch(e){}relabelStages();
 let a=0;try{a=parseInt(localStorage.getItem('zamiigo:active'))||0}catch(e){}if(S.stages.length){try{loadStage(Math.min(a,S.stages.length-1))}catch(e){S.stages=[];clearData()}}}
function relabelStages(){S.stages.forEach((x,i)=>x.label='Batch '+(i+1))}
function clearData(){S.orders=new Map();S.plan=null;S.dataset='';S.notes=[];S.depsInput=[];S.flightsName='';S.stageIdx=0}
function loadStage(i){const st=S.stages[i];if(!st)return;S.stageIdx=i;S.planChoice=st.planChoice||null;loadOrdersText(st.orders,st.file);
 if(st.flights){loadFlightsText(st.flights,st.flightsName)}else{S.depsInput=[];S.flightsName=''}indexItems();runPlan();S.flightView=routeMode()?'routes':'plan';saveStages()}
function batchMeta(){const os=currentOrders();const ds=os.map(o=>o.date).sort();const cs=[...new Set(os.map(o=>o.community))];return {n:os.length,from:ds[0],to:ds[ds.length-1],community:cs.length>2?cs.length+' communities':cs.join(', ')}}
const shortDate=d=>{try{return new Date(dUTC(d)).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}catch(e){return d}};
function metaLine(m){if(!m)return '';const same=m.to&&m.from&&m.to.slice(0,7)===m.from.slice(0,7);const to=m.to&&m.to!==m.from?'–'+(same?String(+m.to.slice(8,10)):shortDate(m.to)):'';return `${shortDate(m.from)}${to} / ${esc(m.community)} / ${m.n} orders`}
function isFlightCSV(text){const h=String(text).split(/\r?\n/)[0].split(',').map(normH);return h.includes('available_payload_lb')||h.includes('available_totes')||(h.includes('departure_date')&&!h.includes('order_id'))}
function addBatch(name,text){S.planChoice=null;loadOrdersText(text,name);const pf=S.pendingFlights;S.pendingFlights=null;
 S.stages.push({label:'',file:name,orders:text,flights:pf?pf.text:null,flightsName:pf?pf.name:'',meta:null});relabelStages();S.stageIdx=S.stages.length-1;
 if(pf)loadFlightsText(pf.text,pf.name);else{S.depsInput=[];S.flightsName=''}indexItems();runPlan();S.flightView=routeMode()?'routes':'plan';S.stages[S.stageIdx].meta=batchMeta();saveStages();
 toast(`${name} added as ${S.stages[S.stageIdx].label}${pf?' with its flight schedule':''}`)}
function attachFlights(name,text){loadFlightsText(text,name);const st=S.stages[S.stageIdx];if(st){st.flights=text;st.flightsName=name}runPlan();saveStages();toast(`${S.depsInput.length} departures added to ${st?st.label:'this batch'}`)}
async function handleFiles(list,force){const files=[...(list||[])];if(!files.length)return;
 const read=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,text:String(r.result)});r.onerror=rej;r.readAsText(f)});
 let items;try{items=await Promise.all(files.map(read))}catch(e){toast('That file could not be read. Check that it is a CSV and try again.','err');return}
 const kind=x=>force||(isFlightCSV(x.text)?'flights':'orders');const fl=items.filter(x=>kind(x)==='flights'),or=items.filter(x=>kind(x)==='orders');
 try{
  if(fl.length&&or.length)S.pendingFlights=fl[fl.length-1];
  for(const o of or)addBatch(o.name,o.text);
  if(fl.length&&!or.length){if(S.stages.length&&S.orders.size)attachFlights(fl[fl.length-1].name,fl[fl.length-1].text);else{S.pendingFlights=fl[fl.length-1];toast('Flight schedule ready. Now add the orders CSV.')}}
 }catch(err){toast(err.message+' Check the file and try again.','err');if(S.stages.length)loadStage(Math.min(S.stageIdx,S.stages.length-1));else clearData()}
 render()}
function renderStages(){const el=$('#stagelist');if(!el)return;
 el.innerHTML=S.stages.length?S.stages.map((x,i)=>S.confirmDel===i?`<div class="batch confirm"><span>Remove ${x.label}?</span><button class="bdel" data-a="delStage" data-v="${i}">Remove</button><button class="bkeep" data-a="keepStage">Keep</button></div>`:`<div class="batch ${i===S.stageIdx?'on':''}"><button class="bsel" data-a="stage" data-v="${i}" title="${esc(x.file)}${x.flightsName?' + '+esc(x.flightsName):''}"><b>${x.label}</b><span>${metaLine(x.meta)||esc(x.file)}</span>${x.flightsName?'<span class="bfl">with flight schedule</span>':''}</button><button class="bx" data-a="delStage" data-v="${i}" aria-label="Remove ${x.label}">×</button></div>`).join('')
 :'<p class="nobatch">No batches yet. Upload an orders CSV to start.</p>'}
function heroArt(){return `<svg class="heroart" viewBox="0 0 800 170" aria-hidden="true">
 <rect width="800" height="170" fill="#E4EEF3"/><circle cx="560" cy="44" r="24" fill="#F6D6A8"/>
 <path d="M0 128 C120 96 220 118 330 104 C450 88 560 112 800 96 V170 H0Z" fill="#D5E3C9"/>
 <path d="M0 146 C160 126 300 142 460 130 C600 120 700 136 800 128 V170 H0Z" fill="#B9CFA8"/>
 <path d="M150 104 Q400 -6 650 88" fill="none" stroke="#C8704E" stroke-width="3" stroke-dasharray="7 9" stroke-linecap="round"/>
 <g transform="translate(96 104)"><path d="M0 0 H62 L56 40 H6Z" fill="#DBA55C"/><path d="M18 11 H44" stroke="#9A6A2A" stroke-width="4" stroke-linecap="round"/><rect x="8" y="-14" width="14" height="14" rx="3" fill="#8FB07A"/><rect x="26" y="-20" width="12" height="20" rx="3" fill="#E9A07F"/><rect x="41" y="-10" width="12" height="10" rx="3" fill="#F3E0B8"/></g>
 <g fill="#5E7F4B"><path d="M300 146 L318 104 L336 146Z"/><path d="M326 146 L350 88 L374 146Z"/><path d="M362 146 L382 110 L402 146Z"/><path d="M470 140 L488 102 L506 140Z"/><path d="M496 140 L518 86 L540 140Z"/></g>
 <g transform="translate(384 16) scale(1.7)"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="#FFFFFF" stroke="#4F86A8" stroke-width="1.3" stroke-linejoin="round"/></g>
 <g transform="translate(650 60)"><path d="M0 40 C0 40 -18 22 -18 10 A18 18 0 0 1 18 10 C18 22 0 40 0 40Z" fill="#C8704E"/><circle cx="0" cy="10" r="7" fill="#fff"/></g>
 <text x="126" y="162" text-anchor="middle" font-family="DM Sans, sans-serif" font-size="13" font-weight="700" fill="#6B4A38">Nakina</text>
</svg>`}
function renderWelcome(){return `<div class="panel welcome">
 <section class="card hero">${heroArt()}<div class="herotx"><h2>Let's get groceries flying north</h2><p>Drop in a batch of Zamiigo orders and Nakina Link plans the rest: retailer entries, shared totes, picker carts and the load for every flight to Webequie, Summer Beaver and Neskantaga.</p></div>
  <label class="dropzone" for="fileAny"><input type="file" id="fileAny" accept=".csv,text/csv" multiple>
   <span class="dzi"><svg class="i" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></svg></span>
   <b>Drop your CSV files here, or click to browse</b><span>Add the orders CSV, plus the flight capacity CSV if there is one. Both can go in together; the app tells them apart.</span></label>
  ${S.pendingFlights?`<p class="note">Flight schedule ${esc(S.pendingFlights.name)} is ready. Add the orders CSV to plan against it.</p>`:''}
  <ol class="steps3"><li><b>Upload orders</b><span>One row per item, grouped by order</span></li><li><b>Add flight capacity</b><span>Optional. Without it, one full Caravan</span></li><li><b>Pack, pick and fly</b><span>Totes, carts, pick lists and manifests</span></li></ol>
 </section>
 <div>
  ${card('What the orders file needs','doc',`<p class="small muted" style="margin:0 0 8px">Column names are matched flexibly, so "order", "order_id" or "Order ID" all work.</p>
   <div class="colchips"><span class="req">order_id</span><span class="req">product_name</span><span class="rec">household_id</span><span class="rec">weight_lb</span><span class="rec">length_in</span><span class="rec">width_in</span><span class="rec">height_in</span><span>order_date</span><span>destination_community</span><span>product_id</span><span>batch_id</span><span>quantity</span><span>aisle</span></div>`)}
 </div>
 <p class="samplelink">No file handy? Take it for a spin with <button class="linkish" data-a="loadSample" data-v="1">the Stage 1 sample</button>, <button class="linkish" data-a="loadSample" data-v="2">the Stage 2 sample with flights</button> or <button class="linkish" data-a="loadSample" data-v="3">the bonus sample with three communities</button></p>
</div>`}
// ===================== RENDER: SHELL =====================
const TITLES={entry:['Order entry',"Get each household's order ready for the retailer site, then follow it all the way to the plane."],picking:['Order picking','Share totes between households, fill the carts, and give pickers a clear route through the store.'],flight:['Flight management','Decide which communities share a flight, check every load against its route, and print the paperwork for the pilot and drivers.']};
function greeting(){const h=new Date().getHours();const g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';let d='';try{d=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}catch(e){}return `${g} <span>${d}</span>`}
function nextStep(icon,title,text,btns){return `<section class="nextcard"><span class="nico">${ico(icon)}</span><div class="ntx"><b>${title}</b><p>${text}</p></div><div class="nbtns">${btns}</div></section>`}
function render(){
 renderStages();
 document.body.dataset.tab=S.tab;const gr=$('#greet');if(gr)gr.innerHTML=greeting();
 if(S.mode==='picker'){document.body.classList.add('pk');$('#picker').innerHTML=renderPicker();return}
 document.body.classList.remove('pk');
 $('#pageTitle').textContent=TITLES[S.tab][0];$('#pageSub').textContent=TITLES[S.tab][1];
 document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
 const os=currentOrders();const items=os.reduce((a,o)=>a+o.items.length,0),w=os.reduce((a,o)=>a+o.w,0);
 $('#dataline').innerHTML=S.orders.size?`<strong>${esc(S.stages[S.stageIdx]?.label||'')}</strong><span>${esc(S.dataset)}</span>${S.flightsName?`<span>${esc(S.flightsName)}</span>`:''}<span>${os.length} orders</span><span>${items} items</span><span>${f1(w)} lb</span><span>${S.plan.deps.length} ${S.plan.deps.length>1?'departures':'departure'}</span>`:'No orders loaded';
 $('#notes').innerHTML=S.notes.map(n=>`<div class="note">${esc(n)}</div>`).join('');
 const m=$('#main');
 if(!S.orders.size){$('#pageTitle').textContent='Welcome to Nakina Link';$('#pageSub').textContent='Upload a batch of Zamiigo orders to plan totes, carts and flights out of Nakina.';$('#dataline').innerHTML='';m.innerHTML=renderWelcome();return}
 m.innerHTML=S.tab==='entry'?renderEntry():S.tab==='picking'?renderPicking():renderFlight();
}

// ===================== RENDER: ORDER ENTRY =====================
function statusChip(s){return `<span class="chip st-${s.toLowerCase()}">${s}</span>`}
function renderEntry(){
 const os=currentOrders();const counts={};STATUSES.forEach(s=>counts[s]=0);os.forEach(o=>counts[S.status[o.id]]++);
 const items=os.reduce((a,o)=>a+o.items.length,0),w=os.reduce((a,o)=>a+o.w,0);
 const q=S.search.trim().toLowerCase();
 const list=os.filter(o=>(S.filter==='all'||S.status[o.id]===S.filter||(S.filter==='rolled'&&S.plan.skipped[o.id]))&&(!q||String(o.id).includes(q)||String(o.hh).includes(q)||o.items.some(it=>it.name.toLowerCase().includes(q))));
 const rolledN=os.filter(o=>S.plan.skipped[o.id]).length;
 const tiles=`<div class="bento4">${tile(os.length,'Household orders','clay','users')}${tile(items,'Items to pick','sage','cart')}${tile(f1(w)+' lb','Total weight','sand','scale')}${tile(S.plan.deps.length,(S.plan.deps.length>1?'Flights':'Flight')+(S.plan.routeMode?` to ${S.plan.comms.length} ${S.plan.comms.length===1?'community':'communities'}`:''),'slate','plane')}</div>`;
 const pipe=card('Order status','flow',`<div class="pipeline">${STATUSES.map((s,i)=>`<button class="stage ${S.filter===s?'on':''}" data-a="filter" data-v="${s}"><span class="num">${counts[s]}</span><span>${s}</span></button>${i<STATUSES.length-1?'<span class="arrow" aria-hidden="true"></span>':''}`).join('')}</div>`,{sub:statusSummary(counts,os.length)});
 const table=`<div class="toolbar"><input type="search" placeholder="Search order, household or product" value="${esc(S.search)}" data-in="search" aria-label="Search orders">
  <select data-in="filter" aria-label="Filter by status"><option value="all">All statuses</option>${STATUSES.map(s=>`<option ${S.filter===s?'selected':''}>${s}</option>`).join('')}<option value="rolled" ${S.filter==='rolled'?'selected':''}>Rolled over (${rolledN})</option></select></div>
 <div class="tablewrap"><table class="grid"><thead><tr><th>Order</th><th>Household</th><th>Community</th><th>Placed</th><th class="r">Items</th><th class="r">Weight</th><th>Flight</th><th>Status</th><th></th></tr></thead><tbody>
 ${list.map(o=>{const open=S.open===o.id;const sk=S.plan.skipped[o.id];return `<tr class="${open?'open':''}"><td><strong>${esc(o.id)}</strong></td><td>HH ${esc(o.hh)}</td><td>${esc(o.community)}</td><td>${fmtDate(o.date)}</td><td class="r">${o.items.length}</td><td class="r">${f1(o.w)} lb</td>
 <td style="white-space:nowrap">${esc(flightLabel(o.id))}${sk?` <span class="chip warn" title="Did not fit flight ${sk.join(', ')}">rolled over</span>`:''}</td><td>${statusChip(S.status[o.id])}${o.items.some(it=>S.oos[it.idx])?' <span class="chip bad">out of stock</span>':''}</td>
 <td class="r"><button class="btn sm" data-a="open" data-v="${esc(o.id)}" aria-expanded="${open}">${open?'Close':'Prepare entry'}</button></td></tr>
 ${open?`<tr class="detail"><td colspan="9"><div class="entry">
   <div><h4>Retailer-ready entry</h4><pre class="ticket">${esc(retailerText(o))}</pre>
   <div class="row"><button class="btn primary" data-a="copy" data-v="${esc(o.id)}">Copy for retailer site</button><button class="btn" data-a="submit" data-v="${esc(o.id)}">Mark submitted</button></div></div>
   <div><h4>Status</h4><ol class="timeline">${STATUSES.map(s=>`<li class="${rank(s)<=rank(S.status[o.id])?'done':''}"><button class="linkish" data-a="setStatus" data-v="${esc(o.id)}" data-s="${s}">${s}</button></li>`).join('')}</ol>
   <p class="muted small">Picking and Picked update automatically as the picker checks items. Loaded is set when the flight manifest is confirmed, and Delivered when the driver marks the household on the manifest.</p>
   ${packingOf(o.id)}${oosNote(o)}</div></div></td></tr>`:''}`}).join('')}
 </tbody></table>${list.length?'':'<p class="empty small">No orders match this filter.</p>'}</div>`;
 const tcard=card('Household orders','list',table,{sub:`${list.length} of ${os.length} shown`,actions:`<button class="btn" data-a="bulkSubmit">Mark all entered as submitted</button><button class="btn primary" data-a="exportRetailer">Export retailer entries</button>`});
 const ns=nextStep('cart','Next: pack and pick',counts.Entered===os.length?'Submit the orders to the retailer, then head to picking. Totes and carts are already planned for you.':'Totes and carts are ready. Send pickers out with a pick list or Picker mode on a phone.',`<button class="btn primary" data-a="tab" data-v="picking">Go to order picking</button>`);
 return `<div class="panel">${tiles}${pipe}${tcard}${ns}</div>`}
function statusSummary(c,n){if(!n)return '';if(c.Delivered===n)return 'Every order is delivered. Batch complete.';if(c.Delivered)return `${c.Delivered} of ${n} orders delivered so far. Tap a stage to filter.`;if(c.Loaded===n)return "Everything's on board. Nice work.";if(c.Picked+c.Loaded===n)return 'Every order is picked and ready to fly.';if(c.Picking||c.Picked)return `Pickers are in the aisles: ${c.Picked+c.Loaded} of ${n} orders done. Tap a stage to filter.`;if(c.Submitted)return `${c.Submitted} of ${n} orders are with the retailer. Tap a stage to filter.`;return "Everything's entered. Submit orders to the retailer to get started."}
function packingOf(oid){const n=S.plan.assign[oid];if(!n)return `<p class="small"><strong>Not on a scheduled flight yet.</strong> This order rolls over to the next departure.</p>`;
 const d=S.plan.deps[n-1];const bags=d.totes_.flatMap(t=>t.bags.filter(b=>b.orderId===oid).map(b=>({t,b})));
 return `<h4>Packed in</h4><ul class="plain">${bags.map(({t,b})=>`<li>Bag <strong>${b.label}</strong> on cart ${t.cart}${b.parts>1?` (part ${b.part} of ${b.parts})`:''}, ${b.items.length} items, ${f1(b.w)} lb</li>`).join('')}</ul>`}

// ===================== RENDER: PICKING =====================
function depSelector(key){const deps=S.plan.deps;if(deps.length<2)return '';
 return `<div class="depsel" role="tablist">${deps.map((d,i)=>`<button role="tab" aria-selected="${S[key]===i}" data-a="dep" data-k="${key}" data-v="${i}"><strong>Flight ${d.n}</strong><span>${d.stops?esc(stopsLabel(d)):fmtDate(d.date)}</span><span>${d.depTime?d.depTime+', ':''}${d.orderIds.length} orders, ${d.nT} totes</span></button>`).join('')}</div>`}
function bar(v,label,cls=''){const p=Math.min(100,v*100);return `<div class="bar ${cls} ${v>1.0001?'over':''}" title="${label}"><i style="width:${p}%"></i></div>`}
function renderPicking(){
 const d=S.plan.deps[S.pickDep];
 const bar2=`<div class="subbar">${subnav('pickView',[['overview','Overview'],['totes','Tote grouping'],['lists','Pick lists']])}<span class="grow"></span>
  <label class="inline">Totes per cart <input type="number" min="1" max="12" value="${S.cfg.cartSize}" data-in="cartSize"></label>
  ${S.edited?'<span class="chip warn">Adjusted by staff</span>':''}<label class="btn file">Upload orders CSV<input type="file" id="fileOrders2" accept=".csv,text/csv"></label><button class="btn ${S.replanArm?'primary':''}" data-a="replan">${S.replanArm?'Click again to confirm':'Re-optimize totes'}</button></div>`;
 const body=S.pickView==='overview'?pickOverview(d):S.pickView==='totes'?renderTotes(d):renderLists(d);
 const ns=nextStep('plane','Next: load the plane',`Once the carts are packed, these ${d.nT} totes go straight onto Flight ${d.n}. Weights are already added up for the load plan.`,`<button class="btn" data-a="mode" data-v="picker">Open picker mode</button><button class="btn primary" data-a="tab" data-v="flight">Go to flight management</button>`);
 return `<div class="panel">${depSelector('pickDep')}${bar2}${body}${ns}</div>`}
function pickOverview(d){const T=d.totes_;
 const complete=d.orderIds.filter(oid=>T.filter(t=>t.bags.some(b=>b.orderId===oid)).length===1).length;
 const split=d.orderIds.length-complete;const avgFill=T.length?T.reduce((a,t)=>a+t.vol,0)/(T.length*S.cfg.toteVol):0;
 const tiles=`<div class="bento6">${tile(T.length,'Totes','clay','box')}${tile(d.orderIds.length,'Orders','sage','users')}${tile(T.length?(d.orderIds.length/T.length).toFixed(1):0,'Orders per tote','sand','grid')}${tile(complete,'Whole in one tote','slate','check')}${tile(split,'Split across totes','clay','split')}${tile(pct(avgFill),'Average fill','sage','fill')}</div>`;
 const carts=card('Carts','cart',`<div class="cartlist">${d.carts.map((k,i)=>{const o=new Set(k.totes.flatMap(t=>t.bags.map(b=>b.orderId)));const n=k.totes.reduce((a,t)=>a+t.bags.reduce((x,b)=>x+b.items.length,0),0);const w=k.totes.reduce((a,t)=>a+t.w,0);
  return `<div class="cartrow"><span class="cartno">${k.n}</span><div><strong>Cart ${k.n}</strong><span class="muted small">${k.totes.map(t=>t.id).join(', ')}</span></div><span class="kv"><b>${o.size}</b>orders</span><span class="kv"><b>${n}</b>items</span><span class="kv"><b>${f1(w)}</b>lb</span><button class="btn sm" data-a="gocart" data-v="${i}">Pick list</button></div>`}).join('')}</div>`,{sub:`${S.cfg.cartSize} totes per cart; a split order always stays on one cart`});
 const fillc=card('Tote fill','fill',`<div class="filllist">${T.map(t=>`<div class="fillrow ${toteOver(t)?'bad':''}"><strong>${t.id}</strong><div class="fb2"><span>Volume</span>${bar(t.vol/S.cfg.toteVol,'Volume')}<em>${pct(t.vol/S.cfg.toteVol)}</em></div><div class="fb2"><span>Weight</span>${bar(t.w/capW(),'Weight','w')}<em>${f1(t.w)} lb</em></div></div>`).join('')}</div>`,{sub:`Limits: ${pct(S.cfg.maxFill)} of volume, ${S.cfg.maxToteLb} lb`});
 return `${savingsStory(d)}${tiles}<div class="two">${carts}${fillc}</div>`}
function savingsStory(d){const T=d.totes_;if(!T.length)return '';const os=d.orderIds.map(o=>S.orders.get(o));const hh=new Set(os.map(o=>o.hh)).size;
 const V=os.reduce((a,o)=>a+o.vol,0),W=os.reduce((a,o)=>a+o.w,0);const lb=Math.max(1,Math.ceil(V/capV()),Math.ceil(W/capW()));const saved=hh-T.length;
 const gap=T.length-lb;const tail=gap<=0?"That's the theoretical minimum for this weight and volume.":`That's within ${gap} ${gap===1?'tote':'totes'} of the theoretical minimum of ${lb}.`;
 return `<div class="story win"><span class="sico">${ico('box')}</span><p><b>${hh} households share ${T.length} totes</b>${saved>0?` instead of one each: ${saved} fewer totes to pick, carry and fly (${pct(saved/hh)} saved).`:'.'} ${tail}</p></div>`}
function renderTotes(d){
 if(!d.totes_.length) return `<p class="empty">No orders are scheduled on this flight.</p>`;
 const multi=new Set(d.totes_.map(toteComm)).size>1;
 return card('Tote grouping','box',`<div class="totes">${d.carts.map(k=>`<div class="cartgroup"><h3>Cart ${k.n}${multi?` <em class="commchip">${esc(toteComm(k.totes[0]))}</em>`:''}${k.spill?' <span class="chip warn">large order spans carts</span>':''}</h3><div class="totegrid">
 ${k.totes.map(t=>{const vf=t.vol/S.cfg.toteVol,wf=t.w/capW();return `<article class="tote ${toteOver(t)?'bad':''}">
  <header><strong>${t.id}${multi?` <em class="commchip">${esc(toteComm(t))}</em>`:''}</strong><span>${f1(t.w+S.cfg.toteTare)} lb</span></header>
  <div class="meters"><label>Volume ${pct(vf)}</label>${bar(vf,'Volume fill')}<label>Weight ${pct(wf)} of ${S.cfg.maxToteLb} lb</label>${bar(wf,'Weight','w')}</div>
  ${toteOver(t)?'<p class="warnline">Over tote limit. Move a bag out.</p>':''}${t.solo?'<p class="warnline">Holds an item larger than a tote.</p>':''}
  <ul class="bags">${t.bags.map(b=>`<li style="--h:${hue(b.orderId)}"><div><strong>${b.letter}</strong> HH ${esc(b.hh)} / order ${esc(b.orderId)}${b.parts>1?` <em>(part ${b.part}/${b.parts})</em>`:''}<br><span class="muted small">${b.items.length} items, ${f1(b.w)} lb, ${f0(b.vol)} in³</span></div>
   <select data-in="move" data-t="${t.id}" data-o="${esc(b.orderId)}" aria-label="Move bag ${b.label}"><option value="">Move to…</option>${d.totes_.filter(x=>x!==t&&toteComm(x)===toteComm(t)).map(x=>`<option>${x.id}</option>`).join('')}<option value="new">New tote</option></select></li>`).join('')}</ul></article>`}).join('')}
 </div></div>`).join('')}</div>`,{sub:'Each coloured block is one household bag. Use Move to if a bag should go in another tote; the flight plan updates too.'})}
function hue(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h}
function renderLists(d){
 if(!d.carts.length)return `<p class="empty">No carts on this flight.</p>`;
 const k=d.carts[Math.min(S.cartSel,d.carts.length-1)];
 const walk=new Map();for(const t of k.totes)for(const b of t.bags)for(const it of b.items){const key=it.pid+'|'+it.name;if(!walk.has(key))walk.set(key,{name:it.name,pid:it.pid,aisle:it.aisle,drops:new Map(),idx:[]});const w=walk.get(key);w.idx.push(it.idx);w.drops.set(b.label,(w.drops.get(b.label)||0)+1)}
 const wl=[...walk.values()].sort((a,b)=>aisleRank(a.aisle)-aisleRank(b.aisle)||a.name.localeCompare(b.name));
 const all=k.totes.flatMap(t=>t.bags.flatMap(b=>b.items.map(i=>i.idx)));const done=all.filter(i=>S.picks[i]).length;
 return card('Cart pick lists','cart',`<div class="toolbar"><div class="seg carts" role="tablist">${d.carts.map((c,i)=>`<button role="tab" aria-selected="${c===k}" data-a="cart" data-v="${i}">Cart ${c.n}</button>`).join('')}</div><span class="grow"></span>
 <button class="btn" data-a="print" data-v="picklist">Print cart ${k.n}</button></div>
 <div id="picklist" class="picklist">
 <div class="plhead"><h2>Flight ${d.n} / Cart ${k.n}</h2><span>${d.stops?esc(toteComm(k.totes[0]))+' / ':''}${depWhen(d)} / Totes ${k.totes.map(t=>t.id).join(', ')}</span><span class="prog">${done} of ${all.length} items picked</span>${bar(all.length?done/all.length:0,'progress')}</div>
 <div class="plcols">
 <section><h3>Walk the store once</h3><p class="muted small">Grouped by aisle in store order. Every product appears once: pick the full quantity, then drop into the bags listed.</p>
 <table class="grid pick"><thead><tr><th></th><th>Product</th><th class="r">Qty</th><th>Drop into</th></tr></thead><tbody>
 ${wl.map((w,j)=>{const all2=w.idx.every(i=>S.picks[i]);return `${j===0||wl[j-1].aisle!==w.aisle?`<tr class="aislerow"><td colspan="4">${esc(w.aisle)}</td></tr>`:''}<tr class="${all2?'picked':''}"><td><input type="checkbox" aria-label="Picked ${esc(w.name)}" data-in="pickgroup" data-v="${w.idx.join(',')}" ${all2?'checked':''}></td><td>${esc(w.name)}<br><span class="muted small">#${esc(w.pid)}</span></td><td class="r"><strong>${w.idx.length}</strong></td><td>${[...w.drops].map(([l,q])=>`<span class="drop">${l}${q>1?' ×'+q:''}</span>`).join(' ')}</td></tr>`}).join('')}
 </tbody></table></section>
 <section><h3>Pack by tote and household</h3>
 ${k.totes.map(t=>`<div class="pltote"><h4>${t.id} <span class="muted">${f1(t.w)} lb, ${pct(t.vol/S.cfg.toteVol)} full</span></h4>
  ${t.bags.map(b=>`<div class="plbag" style="--h:${hue(b.orderId)}"><div class="bagtag">Bag ${b.label} / HH ${esc(b.hh)} / order ${esc(b.orderId)}${b.parts>1?` / part ${b.part} of ${b.parts}`:''}</div>
   <ul>${groupItemsIdx(b.items).map(g=>`<li class="${g.idx.every(i=>S.picks[i])?'picked':''}"><label><input type="checkbox" data-in="pickgroup" data-v="${g.idx.join(',')}" ${g.idx.every(i=>S.picks[i])?'checked':''}> ${g.idx.length>1?`<strong>${g.idx.length}×</strong> `:''}${esc(g.name)}</label></li>`).join('')}</ul></div>`).join('')}</div>`).join('')}
 </section></div></div>`,{sub:'Walk the store once, then pack tote by tote'})}
function groupItemsIdx(items){const m=new Map();for(const it of items){const k=it.pid+'|'+it.name;if(!m.has(k))m.set(k,{name:it.name,idx:[]});m.get(k).idx.push(it.idx)}return [...m.values()]}

// ===================== RENDER: FLIGHT =====================
function renderFlight(){
 const P=S.plan,C=S.cfg;const d=P.deps[S.flightDep];
 const cards=P.deps.map((x,i)=>{const lbLeft=x.payload-x.weight;const cost=x.route?C.costPerHour*x.route.hours:C.costPerHour*C.blockHours*(x.payload/C.payload);
  return `<button class="fcard ${S.flightDep===i?'on':''} ${x.ok?'':'bad'}" data-a="dep" data-k="flightDep" data-v="${i}">
  <div class="fh"><span class="fic">${ico('plane')}</span><strong>Flight ${x.n}</strong><span>${x.depTime?x.depTime+' to '+x.retTime:fmtDate(x.date)}</span></div>${x.route?`<div class="fcodes">${x.route.codes.join(' → ')}<small>${esc(stopsLabel(x))}</small></div>`:''}
  <div class="fm"><span>Weight</span>${bar(x.weight/x.payload,'weight','w')}<em>${f0(x.weight)} / ${f0(x.payload)} lb</em></div>
  <div class="fm"><span>Totes</span>${bar(x.nT/x.totes,'totes')}<em>${x.nT} / ${x.totes}</em></div>
  <div class="fm"><span>Volume</span>${bar(x.volUsed/x.vol,'volume')}<em>${f1(x.volUsed)} / ${f1(x.vol)} ft³</em></div>
  <div class="fb"><span>${x.orderIds.length} orders</span><span>Binding: <b>${x.binding[0].toLowerCase()}</b> ${pct(x.binding[1])}</span></div>
  <div class="fb muted"><span>${f0(lbLeft)} lb left</span><span>~$${f0(x.orderIds.length?cost/x.orderIds.length:0)} per order</span></div></button>`}).join('');
 const rolledOs=currentOrders().filter(o=>P.skipped[o.id]);
 if(P.routeMode&&!['routes','plan','manifest','rollover','settings'].includes(S.flightView))S.flightView='routes';if(!P.routeMode&&S.flightView==='routes')S.flightView='plan';
 const nav=`<div class="subbar">${subnav('flightView',[...(P.routeMode?[['routes','Route plan']]:[]),['plan','Load plan'],['manifest','Manifest'],['rollover',P.routeMode?`Not planned (${P.unassigned.length})`:`Roll-over (${rolledOs.length+P.unassigned.length})`],['settings','Assumptions and settings']])}</div>`;
 let body='';
 if(S.flightView==='routes') body=routesView();
 else if(S.flightView==='plan') body=`${S.edited?'<p class="note">Totes were adjusted by hand in the picking tab. These figures use those adjusted totes.</p>':''}<div class="flightdetail">${cabinSVG(d)}${loadSummary(d)}</div>`;
 else if(S.flightView==='manifest') body=manifest(d);
 else if(S.flightView==='rollover'){
  const rows=rolledOs.map(o=>`<tr><td><strong>${esc(o.id)}</strong></td><td>HH ${esc(o.hh)}</td><td>${fmtDate(o.date)}</td><td class="r">${f1(o.w)} lb</td><td>Did not fit flight ${P.skipped[o.id].join(', ')}</td><td>${P.assign[o.id]?`<span class="chip ok">Flight ${P.assign[o.id]}</span>`:'<span class="chip warn">Waiting</span>'}</td></tr>`).join('');
  body=card(P.routeMode?'Orders not planned':'Orders moved to a later departure','roll',(rows?`<div class="tablewrap"><table class="grid"><thead><tr><th>Order</th><th>Household</th><th>Placed</th><th class="r">Weight</th><th>Why</th><th>Now on</th></tr></thead><tbody>${rows}</tbody></table></div>`:(P.unassigned.length&&P.routeMode?'':'<p class="empty">Every order made its first eligible flight.</p>'))
   +(P.unassigned.length?(P.routeMode?(()=>{const by={};P.unassigned.forEach(o=>(by[o.community]=by[o.community]||[]).push(o));return `<p class="warnline">${P.unassigned.length} ${P.unassigned.length===1?'order is':'orders are'} for ${Object.keys(by).map(c=>esc(c)).join(', ')}, which ${Object.keys(by).length===1?'is not one of':'are not among'} the routes out of Nakina (${DEST.map(d=>d.community).join(', ')}). They are held back until a route is added.</p><div class="tablewrap"><table class="grid"><thead><tr><th>Order</th><th>Household</th><th>Community</th><th class="r">Items</th><th class="r">Weight</th></tr></thead><tbody>${P.unassigned.map(o=>`<tr><td><strong>${esc(o.id)}</strong></td><td>HH ${esc(o.hh)}</td><td>${esc(o.community)}</td><td class="r">${o.items.length}</td><td class="r">${f1(o.w)} lb</td></tr>`).join('')}</tbody></table></div>`})():`<p class="warnline">${P.unassigned.length} orders have no departure yet (${f1(P.unassigned.reduce((a,o)=>a+o.w,0))} lb). Add a departure to schedule them.</p>`):''),{sub:P.routeMode?'Orders the route plan could not place':'Oldest orders get first claim on the next flight'});
 } else body=`<div class="two">${assumptions()}${settings()}</div>`;
 const ns=S.flightView==='manifest'?nextStep('check','Ready for take-off','Print this manifest for the pilot, the loader and the drivers at each stop. Confirm the load once the totes are on board.',`<button class="btn primary" data-a="print" data-v="manifest">Print manifest</button>`)
  :nextStep('doc','Last step: the manifest',"Everyone who handles the totes gets the same list: the pilot, the loader and the drivers in each community.",`<button class="btn primary" data-a="sub" data-k="flightView" data-v="manifest">Open the manifest</button>`);
 return `<div class="panel"><div class="fcards">${cards}</div>${S.flightView==='routes'?'':loadStory(d)}${nav}${body}${ns}</div>`}
function loadStory(d){const lb=d.payload-d.weight,sl=d.totes-d.nT;const b=d.binding[0];
 let t,cls='';if(!d.ok){t=`Flight ${d.n} is over its limit. Move some totes to a later flight in the picking tab.`;cls='bad'}
 else if(d.binding[1]>=0.9){t=`${b==='Weight'?'Weight':b==='Tote slots'?'Space for totes':'Cargo volume'} is the limit on Flight ${d.n}: ${f0(Math.max(0,lb))} lb of payload and ${sl} tote ${sl===1?'slot':'slots'} left.`;cls='tight'}
 else t=`Plenty of room on Flight ${d.n}: ${f0(lb)} lb of payload and ${sl} tote slots are still free.`;
 const roll=currentOrders().filter(o=>(S.plan.skipped[o.id]||[]).includes(d.n)).length;
 return `<div class="story ${cls}"><span class="sico">${ico(cls==='bad'?'info':cls==='tight'?'scale':'check')}</span><p>${t}${roll?` ${roll} ${roll===1?'order waits':'orders wait'} for the next departure.`:''}</p></div>`}

function routesView(){const P=S.plan,C=S.cfg,ch=P.chosen,base=P.base;if(!ch)return '<p class="empty">No communities to plan.</p>';
 const money=n=>'$'+f0(n);
 const savedH=base&&base!==ch?base.hours-ch.hours:0,savedF=base&&base!==ch?base.fuel-ch.fuel:0;
 const head=`<div class="story win"><span class="sico">${ico('plane')}</span><p><b>Best plan: ${ch.n===1?'one round trip':ch.n+' flights'}${ch.n===1?', '+ch.flights[0].route.codes.join(' → '):''}.</b> ${hhm(ch.hours)} in the air and about ${f0(ch.fuel)} lb of fuel${savedH>0.01?`, which saves ${hhm(savedH)}, ${f0(savedF)} lb of fuel and about ${money(savedH*C.costPerHour)} against flying each community separately`:''}.</p></div>`;
 const rows=P.comms.map(c=>{const d=destOf(c),os=currentOrders().filter(o=>o.community===c),t=P.packC[c];return `<tr><td><strong>${d.code}</strong> ${esc(d.airport)}</td><td>${esc(c)}</td><td class="r">${d.nm}</td><td class="r">${f0(d.nm*1.15078*2)}</td><td class="r">${d.hours}</td><td class="r">${f0(d.fuel)}</td><td class="r"><b>${f0(d.payload)}</b></td><td class="r">${os.length}</td><td class="r">${f0(depWeight(t))}</td><td class="r">${t.length}</td></tr>`}).join('');
 const routesCard=card('Routes from Nakina','plane',`<div class="tablewrap"><table class="grid"><thead><tr><th>Airport</th><th>Community</th><th class="r">One-way nm</th><th class="r">Round trip mi</th><th class="r">Hours</th><th class="r">Fuel lb</th><th class="r">Payload lb</th><th class="r">Orders</th><th class="r">Cargo lb</th><th class="r">Totes</th></tr></thead><tbody>${rows}</tbody></table></div>`,{sub:'Sponsor figures. Each community is packed into its own totes.'});
 const pr=P.pairs.map(p=>{const save=p.sepHours-p.route.hours;return `<tr><td><b>${esc(p.a)} + ${esc(p.b)}</b></td><td class="r">${p.sepN} flights, ${hhm(p.sepHours)}</td><td>${p.route.codes.join(' → ')}</td><td class="r">${hhm(p.route.hours)}</td><td class="r">${f0(p.cargo)} of ${f0(p.route.payload)} lb</td><td class="r">${p.totes} of ${maxT()}</td><td>${p.ok?`<span class="chip ok">Combine, saves ${hhm(save)}</span>`:`<span class="chip bad">Doesn't fit: ${esc(p.why)}</span>`}</td></tr>`}).join('');
 const pairCard=P.pairs.length?card('Two communities on one trip?','split',`<div class="tablewrap"><table class="grid"><thead><tr><th>Pair</th><th class="r">Separate</th><th>Combined route</th><th class="r">Combined</th><th class="r">Payload used</th><th class="r">Totes</th><th>Verdict</th></tr></thead><tbody>${pr}</tbody></table></div>
  <p class="small muted" style="margin:10px 0 0">Same payload method as the sponsor. Flight time is statute miles ÷ ${S.cfg.speedMph} mph plus ${Math.round(LEG_H*60)} min for each take-off and landing, which reproduces the sponsor's 2.49, 2.46 and 1.96 h. Fuel follows flight time (${f0(FUEL.fix)} lb + ${f1(FUEL.per)} lb per hour matches all three sponsor fuel figures within 1 lb), so every extra stop costs fuel. Payload is 3,923 lb less fuel. Distances between communities are great-circle distances from the airport coordinates, which match the sponsor's Nakina distances within 0.5 nm.</p>`,{sub:'Each pair tested against two separate flights'}):'';
 const opt=P.options.map(o=>`<tr class="${o===ch?'bind':''}"><td>${o.groups.map(g=>g.join(' + ')).join('<br>')}</td><td class="r">${o.n}</td><td class="r">${hhm(o.hours)}</td><td class="r">${f0(o.fuel)}</td><td class="r">${money(o.cost)}</td><td>${!o.ok?`<span class="chip bad">${esc(o.why)}</span>`:o===ch?'<span class="chip ok">In use</span>':`<button class="btn sm" data-a="usePlan" data-v="${esc(o.key)}">Use this plan</button>`}</td></tr>`).join('');
 const optCard=card('Every way to fly this batch','grid',`<div class="tablewrap"><table class="grid"><thead><tr><th>Trips</th><th class="r">Flights</th><th class="r">In the air</th><th class="r">Fuel lb</th><th class="r">Aircraft cost</th><th></th></tr></thead><tbody>${opt}</tbody></table></div>`,{sub:'Fewest flight hours first. Staff can pick another plan and everything follows it.'});
 const tl=P.deps.map(d=>`<div class="leg"><div class="legh"><b>Flight ${d.n}</b><span>${d.depTime} to ${d.retTime}</span><span class="chip">${d.nT} totes, ${f0(d.weight)} of ${f0(d.payload)} lb</span></div>
  <ol class="hops"><li><b>${d.depTime}</b> Depart CYQN Nakina</li>${d.stopTimes.map(x=>`<li><b>${clock(x.arr)}</b> Land ${x.code}, ${esc(x.name)}: ${d.totes_.filter(t=>toteComm(t)===x.name).length} totes off</li>`).join('')}<li><b>${d.retTime}</b> Back at CYQN</li></ol></div>`).join('');
 const seqCard=card('Flight sequence','flow',`${tl}<p class="small muted" style="margin:8px 0 0">Flights that reach the most households per hour go first. The first stop's totes load by the cargo door so they come off first. Times assume ${C.groundMin} min on the ground at each stop and ${C.turnMin} min to turn around at Nakina.</p>`,{sub:'Departure order and times'});
 return head+routesCard+pairCard+optCard+seqCard}

function loadSummary(d){const C=S.cfg;const cabinFt=C.cabinLen*C.cabinW*C.cabinH/1728,toteFt=C.toteOutL*C.toteOutW*C.toteOutH/1728;
 const r=[['Weight',d.weight,d.payload,'lb'],['Tote slots',d.nT,d.totes,''],['Volume (tote-equivalent)',d.volUsed,d.vol,'ft³']];
 return `<div class="loadsum card"><div class="cardhead"><span class="cico">${ico('scale')}</span><div class="ct2"><h3>Flight ${d.n} load check</h3><p>Weight, tote slots and space</p></div><span class="grow"></span>${d.ok?'<span class="chip ok">Fits</span>':'<span class="chip bad">Over limit</span>'}</div>
 <table class="grid"><thead><tr><th>Limit</th><th class="r">Used</th><th class="r">Available</th><th class="r">Left</th></tr></thead><tbody>
 ${r.map(([n,u,a,un])=>`<tr class="${n===d.binding[0]?'bind':''}"><td>${n}${n===d.binding[0]?' <span class="chip">binding</span>':''}</td><td class="r">${un==='ft³'?f1(u):f0(u)} ${un}</td><td class="r">${un==='ft³'?f1(a):f0(a)} ${un}</td><td class="r"><strong>${un==='ft³'?f1(a-u):f0(a-u)} ${un}</strong></td></tr>`).join('')}
 <tr><td>Open cabin space</td><td class="r">${f1(d.nT*toteFt)} ft³</td><td class="r">${f1(cabinFt)} ft³</td><td class="r"><strong>${f1(cabinFt-d.nT*toteFt)} ft³</strong></td></tr>
 </tbody></table>
 <p class="small muted">Payload ${f0(d.payload)} lb for ${d.route?d.route.codes.join(' → '):'CYQN to CYWP'} (3,923 lb low operating weight less ${f0(d.route?d.route.fuel:1046)} lb fuel). A full hold of ${cabinSlots()} totes would need totes under ${f1(C.payload/cabinSlots())} lb on average before weight binds. This flight averages ${f1(d.nT?d.weight/d.nT:0)} lb per tote.</p></div>`}
function cabinSVG(d){const C=S.cfg,cw=80,ch=76,ox=96,oy=34,W=ox+C.rows*cw+70,H=oy+C.cols*ch+46;
 const stacks={};d.totes_.forEach(t=>{if(t.pos){const k=t.pos.r+'-'+t.pos.c;(stacks[k]=stacks[k]||[]).push(t)}});
 const cap={};for(let r=0;r<C.rows;r++)for(let c=0;c<C.cols;c++)cap[r+'-'+c]=levelsAt(c);d.blockedPos.forEach(p=>cap[p.r+'-'+p.c]--);
 let cells='';for(let r=0;r<C.rows;r++)for(let c=0;c<C.cols;c++){const k=r+'-'+c,s=stacks[k]||[],n=s.length,w=s.reduce((a,t)=>a+t.w,0);
  const x=ox+r*cw,y=oy+c*ch;const sel=S.cellSel===k;
  cells+=`<g class="cell ${sel?'sel':''}" data-a="cell" data-v="${k}" tabindex="0" role="button" aria-label="Row ${r+1} position ${c+1}: ${n} of ${cap[k]} totes, ${f0(w)} lb">
  <rect x="${x+3}" y="${y+3}" width="${cw-6}" height="${ch-6}" rx="4" class="slot"/>
  ${[...Array(cap[k])].map((_,l)=>`<rect x="${x+8}" y="${y+ch-13-l*8}" width="${cw-16}" height="5" rx="1.5" class="${l<n?'lv on':'lv'}"/>`).join('')}
  <text x="${x+cw/2}" y="${y+18}" class="ct">${n}/${cap[k]}</text>${n?`<text x="${x+cw/2}" y="${y+31}" class="cw">${f0(w)} lb</text>`:''}</g>`}
 const sel=S.cellSel&&stacks[S.cellSel]?stacks[S.cellSel]:null;
 return `<div class="cabin card"><div class="cardhead"><span class="cico">${ico('grid')}</span><div class="ct2"><h3>Cabin load plan</h3><p>Top view, cockpit on the left</p></div></div>
 <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cabin load layout for flight ${d.n}">
  <path d="M${ox-10} ${oy-8} H${ox+C.rows*cw+20} Q${W-8} ${oy-8} ${W-8} ${oy+C.cols*ch/2} Q${W-8} ${oy+C.cols*ch+8} ${ox+C.rows*cw+20} ${oy+C.cols*ch+8} H${ox-10} Q${22} ${oy+C.cols*ch+8} ${14} ${oy+C.cols*ch/2} Q${22} ${oy-8} ${ox-10} ${oy-8}Z" class="fuse"/>
  <text x="46" y="${oy+C.cols*ch/2-4}" class="lab">Forward</text><text x="46" y="${oy+C.cols*ch/2+10}" class="lab">cockpit</text>
  <text x="${ox+C.rows*cw+28}" y="${oy+C.cols*ch/2+4}" class="lab" text-anchor="start">Aft</text>
  <text x="${ox+(C.rows-1)*cw+cw/2}" y="${H-10}" class="lab">cargo door</text>
  ${cells}</svg>
 <p class="small muted">Each square is one floor position (${C.toteOutL} × ${C.toteOutW} in). Bars show stack height, up to ${C.levels} high. Heaviest totes go on the floor and forward first. Select a square to see its totes.</p>
 ${sel?`<div class="stack"><strong>Stack, bottom to top:</strong> ${sel.slice().sort((a,b)=>a.pos.lv-b.pos.lv).map(t=>`${t.id} (${f1(t.w)} lb)`).join(', ')}</div>`:''}</div>`}
function manifest(d){const C=S.cfg;
 const hh=new Map();d.totes_.forEach(t=>t.bags.forEach(b=>{if(!hh.has(b.hh))hh.set(b.hh,[]);hh.get(b.hh).push(b.label)}));const hhC=h=>{const o=d.orderIds.map(x=>S.orders.get(x)).find(o=>String(o.hh)===String(h));return o?o.community:''};const stopIx=h=>d.stops?d.stops.indexOf(hhC(h)):0;
 const allLoaded=d.orderIds.length&&d.orderIds.every(o=>rank(S.status[o])>=rank('Loaded'));
 return `<div class="toolbar"><span class="grow"></span>
 <button class="btn" data-a="exportManifest">Export manifest (CSV)</button><button class="btn" data-a="print" data-v="manifest">Print manifest</button>
 ${d.orderIds.length&&d.orderIds.every(o=>S.status[o]==='Delivered')?'<span class="chip ok">All delivered</span>':allLoaded?'<button class="btn primary" data-a="deliverAll">Mark all delivered</button>':`<button class="btn primary" data-a="confirmLoad" ${!d.orderIds.length?'disabled':''}>Confirm loaded</button>`}</div>
 <div id="manifest" class="manifest">
 <div class="mhead"><div><h2>Zamiigo cargo manifest / Flight ${d.n}</h2><p>${depWhen(d)}${d.retTime?', back '+d.retTime:''} / ${d.route?d.route.codes.join(' → ')+' ('+esc(stopsLabel(d))+')':'CYQN Nakina to CYWP Webequie'} / Cessna 208B Grand Caravan, freighter configuration</p></div>
 <dl>${d.route?`<div><dt>Payload available</dt><dd>${f0(d.payload)} lb</dd></div>`:''}<div><dt>Totes</dt><dd>${d.nT}</dd></div><div><dt>Orders</dt><dd>${d.orderIds.length}</dd></div><div><dt>Cargo weight</dt><dd>${f1(d.weight)} lb</dd></div><div><dt>Payload left</dt><dd>${f1(d.payload-d.weight)} lb</dd></div><div><dt>Space used</dt><dd>${f1(d.volUsed)} of ${f1(d.vol)} ft³</dd></div></dl></div>
 <h3>Pilot and loader: totes on board</h3>
 <div class="tablewrap"><table class="grid"><thead><tr><th>Tote</th>${d.stops&&d.stops.length>1?'<th>Unload at</th>':''}<th>Position</th><th>Cart</th><th class="r">Weight</th><th class="r">Fill</th><th>Bags (household / order)</th></tr></thead><tbody>
 ${d.totes_.slice().sort((a,b)=>(d.stops?d.stops.indexOf(toteComm(a))-d.stops.indexOf(toteComm(b)):0)||a.id.localeCompare(b.id)).map(t=>`<tr><td><strong>${t.id}</strong></td>${d.stops&&d.stops.length>1?`<td><span class="chip stopchip s${d.stops.indexOf(toteComm(t))}">Stop ${d.stops.indexOf(toteComm(t))+1}: ${esc(destOf(toteComm(t))?.code||'')} ${esc(toteComm(t))}</span></td>`:''}<td>${t.pos?`Row ${t.pos.r+1}, pos ${t.pos.c+1}, level ${t.pos.lv+1}`:'<span class="chip bad">no space</span>'}</td><td>${t.cart}</td><td class="r">${f1(t.w+C.toteTare)} lb</td><td class="r">${pct(t.vol/C.toteVol)}</td><td>${t.bags.map(b=>`${b.letter}: HH ${esc(b.hh)} / ${esc(b.orderId)}${b.parts>1?` (${b.part}/${b.parts})`:''}`).join('; ')}</td></tr>`).join('')}
 <tr class="tot"><td colspan="${d.stops&&d.stops.length>1?4:3}">Total</td><td class="r">${f1(d.weight)} lb</td><td></td><td>${d.nT} totes, ${d.orderIds.length} orders</td></tr></tbody></table></div>
 <div class="mcols"><div><h3>Driver: drop-off by household</h3><table class="grid"><thead><tr>${d.stops&&d.stops.length>1?'<th>Stop</th>':''}<th>Household</th><th>Bags to deliver</th><th>Delivered</th></tr></thead><tbody>
 ${[...hh].sort((a,b)=>stopIx(a[0])-stopIx(b[0])||String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})).map(([h,ls])=>`<tr>${d.stops&&d.stops.length>1?`<td>${stopIx(h)+1}. ${esc(hhC(h))}</td>`:''}<td>HH ${esc(h)}</td><td>${ls.join(', ')}</td><td class="box">${hhDelivered(d,h)?'<span class="chip ok">Delivered</span>':`<button class="btn sm" data-a="deliver" data-v="${esc(h)}">Mark delivered</button>`}</td></tr>`).join('')}</tbody></table></div>
 <div><h3>Retailer: orders to totes</h3><table class="grid"><thead><tr><th>Order</th><th class="r">Items</th><th>Totes</th></tr></thead><tbody>
 ${d.orderIds.map(oid=>{const o=S.orders.get(oid);return `<tr><td>${esc(oid)}</td><td class="r">${o.items.length}</td><td>${d.totes_.filter(t=>t.bags.some(b=>b.orderId===oid)).map(t=>t.id).join(', ')}</td></tr>`}).join('')}</tbody></table></div></div>
 <div class="sign"><span>Loaded by ______________________</span><span>Pilot ______________________</span>${(d.stops||['Webequie']).map(c=>`<span>Received (${esc(c)}) ______________________</span>`).join('')}</div></div>`}
function hhOrders(d,h){return d.orderIds.filter(o=>String(S.orders.get(o)?.hh)===String(h))}
function hhDelivered(d,h){const os=hhOrders(d,h);return os.length&&os.every(o=>S.status[o]==='Delivered')}
function exportManifest(){const d=S.plan.deps[S.flightDep];const rows=[['flight','departure_date','tote_id','cart','position','tote_weight_lb','fill_pct','bag','household_id','order_id','part','items','bag_weight_lb']];
 d.totes_.forEach(t=>t.bags.forEach(b=>rows.push([d.n,d.date,t.id,t.cart,t.pos?`R${t.pos.r+1}-P${t.pos.c+1}-L${t.pos.lv+1}`:'',f1(t.w+S.cfg.toteTare),Math.round(t.vol/S.cfg.toteVol*100),b.label,b.hh,b.orderId,`${b.part}/${b.parts}`,b.items.length,f1(b.w)])));
 download(`manifest_flight_${d.n}.csv`,rows.map(r=>r.map(csvq).join(',')).join('\n'))}
function assumptions(){const C=S.cfg;return `<section class="card"><div class="cardhead"><span class="cico">${ico('info')}</span><div class="ct2"><h3>Assumptions and sources</h3><p>Aircraft, tote and stacking</p></div></div><div class="acols">
 <div><h4>Aircraft</h4><p>Cessna 208B Grand Caravan, the model Wilderness North Air flies out of Nakina, set up as an empty freighter with no passenger seats. Cargo cabin modelled as ${C.cabinLen} in long (the 208's 12.5 ft plus the 208B's extra 4 ft), ${C.cabinW} in wide and ${C.cabinH} in high at the centreline, flat floor: ${f1(C.cabinLen*C.cabinW*C.cabinH/1728)} ft³ gross. The belly cargo pod is kept as spare capacity.</p>
 <p>Payload by route (sponsor figures): Webequie 2,877 lb, Summer Beaver 2,887 lb, Landsdowne House for Neskantaga 3,062 lb, each the 3,923 lb low operating weight less that route's fuel.</p></div>
 <div><h4>Tote and stacking</h4><p>Tote inside ${C.toteL} × ${C.toteW} × ${C.toteH} in, treated as straight-walled; packing volume ${f0(C.toteVol)} in³ with at most ${pct(C.maxFill)} used, since groceries never pack perfectly. Outside at the rim ${C.toteOutL} × ${C.toteOutW} in, and ${C.toteOutH} in per stacked level.</p>
 <p>Totes sit lengthwise, ${C.cols} across (${f1(C.cols*C.toteOutW)} in of ${C.cabinW} in) in ${C.rows} rows (${f0(C.rows*C.toteOutL)} in of ${C.cabinLen} in). The centre columns stack ${C.levels} high (${f0(C.levels*C.toteOutH)} in of ${C.cabinH} in); the outer columns stack ${C.outerLevels} high because the cabin walls curve in. That is ${C.rows} rows of ${(()=>{let n=0;for(let c=0;c<C.cols;c++)n+=levelsAt(c);return n})()} positions, less ${C.blocked} in the aft row where the fuselage tapers: ${cabinSlots()} totes, matching Wilderness North's 90-tote figure.</p>
 <p>Heaviest totes go on the floor and forward. Final weight and balance is the pilot's call.</p></div>
 <div><h4>Sources</h4><ul class="plain small">
 <li>Wilderness North challenge brief: cabin about 64 × 54 in, 12.5 ft on the 208, 90 totes, route payload.</li>
 <li><a href="https://www.tsb.gc.ca/eng/rapports-reports/aviation/2023/a23o0028/a23o0028.html" target="_blank" rel="noopener">Transportation Safety Board of Canada, report A23O0028</a>: Wilderness North Air operates Cessna 208B Caravans from Nakina (CYQN).</li>
 <li><a href="https://en.wikipedia.org/wiki/Cessna_208_Caravan" target="_blank" rel="noopener">Wikipedia, Cessna 208 Caravan</a>: the 208B is 4 ft longer than the 208.</li>
 <li><a href="https://aerocorner.com/aircraft/cessna-caravan/" target="_blank" rel="noopener">AeroCorner, Cessna 208 Caravan</a>: cabin width 5 ft 4 in (64 in).</li>
 <li><a href="https://www.airport-technology.com/projects/caravan/" target="_blank" rel="noopener">Airport Technology, Caravan</a>: flat cabin floor with cargo tie-down tracks.</li></ul></div></div></section>`}
function settings(){const C=S.cfg;const f=(k,l,step='any')=>`<label>${l}<input type="number" step="${step}" value="${+(+C[k]).toFixed(4)}" data-cfg="${k}"></label>`;
 return `<section class="card"><div class="cardhead"><span class="cico">${ico('gear')}</span><div class="ct2"><h3>Planning settings</h3><p>Change a value, then apply to re-plan</p></div></div><div class="setgrid">
 ${f('maxToteLb','Max contents per tote (lb)')}${f('maxFill','Max volume fill (0 to 1)')}${f('toteTare','Empty tote weight (lb)')}${f('toteVol','Tote volume (in³)')}
 ${S.plan&&S.plan.routeMode?`${f('costPerHour','Aircraft cost per flight hour ($)')}${f('groundMin','Minutes on the ground at each stop',1)}${f('turnMin','Turnaround at Nakina (min)',1)}${f('maxStops','Most communities per trip',1)}<label>First departure (24 h)<input type="text" value="${esc(C.firstDeparture)}" data-cfg="firstDeparture"></label>`:`${f('payload','Full-aircraft payload (lb)')}${f('leadDays','Days from order to flight',1)}${f('costPerHour','Aircraft cost per hour ($)')}${f('blockHours','Round-trip hours')}`}
 ${f('rows','Tote rows',1)}${f('cols','Totes across',1)}${f('levels','Stack height, centre',1)}${f('outerLevels','Stack height at the walls',1)}${f('blocked','Aft positions lost',1)}
 <label>Which orders fly first<select data-cfg="priority"><option value="oldest" ${C.priority==='oldest'?'selected':''}>Oldest first, then smallest (most orders)</option><option value="most" ${C.priority==='most'?'selected':''}>Smallest first (most orders)</option><option value="fifo" ${C.priority==='fifo'?'selected':''}>Strict first come, first served</option></select></label>
 </div><div class="row"><button class="btn primary" data-a="applyCfg">Apply and re-plan</button><button class="btn" data-a="resetCfg">Restore defaults</button></div></section>`}

// ===================== MANUAL MOVES =====================
function moveBag(toteId,orderId,target){const d=S.plan.deps[S.pickDep];const from=d.totes_.find(t=>t.id===toteId);if(!from)return;
 const bi=from.bags.findIndex(b=>b.orderId===orderId);const bag=from.bags.splice(bi,1)[0];
 let to=target==='new'?null:d.totes_.find(t=>t.id===target);if(!to){to={bags:[],w:0,vol:0};d.totes_.push(to)}
 addBag(to,bag);finalizeDep(d);S.edited=true;
 const t2=d.totes_.find(t=>t.bags.some(b=>b.orderId===orderId&&t!==from));toast(toteOver(to)?'Moved. That tote is now over its limit.':'Bag moved')}

// ===================== EVENTS =====================
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;const a=el.dataset.a,v=el.dataset.v;
 if(a==='tab'){S.tab=v;render();window.scrollTo(0,0);return}
 if(a==='filter'){S.filter=S.filter===v?'all':v}
 else if(a==='open'){S.open=S.open===v?null:v}
 else if(a==='copy'){copyText(retailerText(S.orders.get(v)));return}
 else if(a==='submit'){if(rank(S.status[v])<rank('Submitted'))S.status[v]='Submitted';save();toast('Marked submitted')}
 else if(a==='setStatus'){S.status[v]=el.dataset.s;save()}
 else if(a==='bulkSubmit'){let n=0;currentOrders().forEach(o=>{if(S.status[o.id]==='Entered'){S.status[o.id]='Submitted';n++}});save();toast(`${n} orders marked submitted`)}
 else if(a==='exportRetailer'){exportRetailer();return}
 else if(a==='dep'){S[el.dataset.k]=+v;S.cartSel=0;S.cellSel=null}
 else if(a==='pickView'){S.pickView=v}
 else if(a==='sub'){S[el.dataset.k]=v}
 else if(a==='mode'){S.mode=v;window.scrollTo(0,0)}
 else if(a==='pkDep'){S.pickDep=+v;S.pk.cart=null}
 else if(a==='pkCart'){S.pk={cart:+v,aisle:null,review:false};window.scrollTo(0,0)}
 else if(a==='pkBack'){S.pk.cart=null;S.pk.review=false}
 else if(a==='pkAisle'){S.pk.aisle=v;S.pk.review=true;window.scrollTo(0,0)}
 else if(a==='pkToggle'){pkToggle(v.split(',').map(Number))}
 else if(a==='pkOos'){pkOosToggle(v.split(',').map(Number))}
 else if(a==='pkAll'){pkToggle(v.split(',').map(Number));toast('Aisle marked picked')}
 else if(a==='pkReview'){S.pk.review=true}
 else if(a==='pkFinish'){S.pk.review=false}
 else if(a==='gocart'){S.cartSel=+v;S.pickView='lists'}
 else if(a==='cart'){S.cartSel=+v}
 else if(a==='replan'){if(S.edited&&!S.replanArm){S.replanArm=true;clearTimeout(S._ra);S._ra=setTimeout(()=>{S.replanArm=false;render()},5000);toast('Click Re-optimize again to replace the hand-adjusted grouping');render();return}S.replanArm=false;runPlan();toast('Totes re-optimized')}
 else if(a==='cell'){S.cellSel=S.cellSel===v?null:v}
 else if(a==='print'){const t=document.getElementById(v);if(!t)return;t.classList.add('printing');document.body.classList.add('is-printing');window.print();setTimeout(()=>{t.classList.remove('printing');document.body.classList.remove('is-printing')},300);return}
 else if(a==='confirmLoad'){const d=S.plan.deps[S.flightDep];d.orderIds.forEach(o=>{if(S.status[o]!=='Delivered')S.status[o]='Loaded'});save();toast(`Flight ${d.n}: ${d.orderIds.length} orders marked loaded`)}
 else if(a==='exportManifest'){exportManifest();return}
 else if(a==='deliver'){const d=S.plan.deps[S.flightDep];hhOrders(d,v).forEach(o=>S.status[o]='Delivered');save();toast(`HH ${v} delivered`)}
 else if(a==='usePlan'){S.planChoice=v;const st=S.stages[S.stageIdx];if(st){st.planChoice=v;saveStages()}runPlan();S.flightView='routes';toast('Plan updated. Totes, carts and manifests follow it.')}
 else if(a==='deliverAll'){const d=S.plan.deps[S.flightDep];d.orderIds.forEach(o=>S.status[o]='Delivered');save();toast(`Flight ${d.n}: every household delivered`)}
 else if(a==='applyCfg'){document.querySelectorAll('[data-cfg]').forEach(i=>{const k=i.dataset.cfg;S.cfg[k]=(k==='priority'||k==='firstDeparture')?i.value:(parseFloat(i.value)||0)});S.cfg.maxFill=Math.min(1,Math.max(.3,S.cfg.maxFill));runPlan();toast('Settings applied and flights re-planned')}
 else if(a==='resetCfg'){S.cfg={...DEFAULT_CFG};runPlan();toast('Defaults restored')}
 else if(a==='keepStage'){S.confirmDel=null}
 else if(a==='delStage'){const i=+v,st=S.stages[i];if(!st)return;if(S.confirmDel!==i){S.confirmDel=i;clearTimeout(S._cd);S._cd=setTimeout(()=>{S.confirmDel=null;render()},6000);render();return}S.confirmDel=null;S.stages.splice(i,1);relabelStages();
  if(!S.stages.length){clearData();saveStages()}else loadStage(S.stageIdx===i?Math.min(i,S.stages.length-1):(S.stageIdx>i?S.stageIdx-1:S.stageIdx));toast(`${st.file} removed`)}
 else if(a==='stage'){loadStage(+v);toast(`${S.stages[+v].label} loaded`)}
 else if(a==='loadSample'){try{if(v==='3'){addBatch('Bonus sample, 3 communities',DATA.bonus);return render()}if(v==='2')S.pendingFlights={name:'flight_capacity_stage2.csv',text:DATA.flights};addBatch(v==='2'?'Challenge sample, Stage 2':'Challenge sample, Stage 1',v==='2'?DATA.stage2:DATA.stage1)}catch(e){toast(e.message,'err')}}
 else return;
 render()});
document.addEventListener('keydown',e=>{if(S.mode==='picker'&&S.pk.cart!=null&&e.key==='Enter'&&!e.target.matches('input,select,textarea,button')){e.preventDefault();pkScanNext();render();return}
if((e.key==='Enter'||e.key===' ')&&e.target.matches('g[data-a]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.in==='search'){S.search=el.value;const pos=el.selectionStart;render();const n=$('[data-in="search"]');if(n){n.focus();n.setSelectionRange(pos,pos)}}});
document.addEventListener('change',e=>{const el=e.target,k=el.dataset.in;
 if(k==='filter'){S.filter=el.value;render()}
 else if(k==='cartSize'){S.cfg.cartSize=Math.max(1,parseInt(el.value)||5);S.plan.deps.forEach(finalizeDep);S.cartSel=0;render()}
 else if(k==='move'&&el.value){moveBag(el.dataset.t,el.dataset.o,el.value);render()}
 else if(k==='pickgroup'){setPick(el.dataset.v.split(',').map(Number),el.checked);render()}
 else if(el.id==='fileOrders'||el.id==='fileOrders2'||el.id==='fileFlights'||el.id==='fileAny'){handleFiles(el.files,el.id==='fileOrders'||el.id==='fileOrders2'?'orders':el.id==='fileFlights'?'flights':null).then(()=>{el.value=''})}});

// ===================== INIT =====================
let dragN=0;
document.addEventListener('dragenter',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){dragN++;document.body.classList.add('dragging')}});
document.addEventListener('dragleave',()=>{dragN=Math.max(0,dragN-1);if(!dragN)document.body.classList.remove('dragging')});
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();dragN=0;document.body.classList.remove('dragging');if(e.dataTransfer&&e.dataTransfer.files.length)handleFiles(e.dataTransfer.files)});
initStages();
try{if(window.matchMedia&&matchMedia('(max-width: 700px)').matches)S.mode='picker'}catch(e){}
render();
