const METRO=["anoka","carver","chisago","dakota","hennepin","isanti","ramsey","scott","sherburne","washington","wright"];
function region(c){return METRO.includes(c)?"metro":(c=="dodge"||c=="olmsted")?"do":"other";}
function startUpLim(b){const r=region(b.county),big=b.hh>=3;return {metro:big?151200:131500,do:big?156100:135800,other:big?136700:118900}[r];}
function stepUpLim(b){return region(b.county)=="other"?177800:196600;}
function dplLim(b){const r=region(b.county),i=Math.min(Math.max(b.hh,2),8)-2;
 const m=[94600,106500,118300,127800,137200,146700,151200],o=[85600,96300,107000,115500,124100,132600,136700];
 if(r=="other")return o[i]; if(i==6&&r=="do")return 156100; return m[i];}
// Credit/DTI from MN Housing matrix (conventional baseline 640/50%) - verify per product
const MNH={minCredit:640,maxDTI:50};
const RULES={
"MN Housing Start Up (first mortgage)":{...MNH,income:startUpLim,ft:true,edu:true},
"MN Housing Step Up (first mortgage)":{...MNH,income:stepUpLim},
"MN Housing Monthly Payment Loan (MPL)":{...MNH,income:b=>b.ft?startUpLim(b):stepUpLim(b)},
"MN Housing Deferred Payment Loan (DPL)":{...MNH,income:dplLim,ft:true,edu:true,minHR:25},
"MN Housing Deferred Payment Loan Plus (DPL+)":{...MNH,income:dplLim,ft:true,edu:true,minHR:25,verify:["DPL+ targeting criteria","$13,000 post-closing liquid asset limit"]},
"MN Housing First-Generation Homebuyer Loan":{closed:true},
"First-Generation Homebuyers Community DPA Fund":{income:()=>118900,ft:true,fg:true,edu:true,minHR:20,verify:["$50k post-closing liquid assets","Start Up price limit","education before purchase agreement"]},
"Hennepin County Homebuyer Assistance (DPA)":{counties:["hennepin"],exclCities:["bloomington","brooklyn park","eden prairie","maple grove","minneapolis","plymouth","richfield","st louis park","st. louis park"],ami:80,edu:true},
"Hennepin County First-Generation Buyers DPA":{counties:["hennepin"],fg:true,closed:true},
"Community Keys Plus Impact":{counties:["anoka","dakota","hennepin","ramsey","washington"]},
"Metro Home DPA":{counties:["anoka","carver","chisago","dakota","hennepin","isanti","ramsey","scott","sherburne","washington","wright"]},
"City of Shoreview First-Time Homeowners Due-on-Sale DPA":{cities:["shoreview"],ft:true},
"City of Shoreview First-Time Homeowners Amortizing DPA":{cities:["shoreview"],ft:true,closed:true},
"Southern Ridge Twin Homes DPA":{counties:["stearns"],cities:["st. cloud","st cloud","saint cloud"],ami:80,price:400000,verify:["home must be in Southern Ridge Twin Homes development"]},
"Project Reinvest DPA":{counties:["anoka","carver","dakota","hennepin","ramsey","scott","washington"],closed:true},
"Stearns County HTF DPA":{counties:["stearns"],closed:true},
"Welcome Home DPA":{closed:true},
"Minneapolis Homes: Access DPA":{cities:["minneapolis"],closed:true},
"Minneapolis Down Payment Assistance Loan":{cities:["minneapolis"],ft:true},
"Saint Paul Citywide Downpayment Assistance (incl. First Gen layer)":{cities:["st paul","st. paul","saint paul"],ami:80,edu:true,closed:true,verify:["assets < $25,000"]},
"Carver County CDA Standard DPA":{counties:["carver"],income:()=>131500,edu:true,ftOrFg:true},
"Carver County CDA First-Generation Set-Aside DPA":{counties:["carver"],income:()=>131500,edu:true,fg:true},
"Washington County CDA First-Generation Homebuyer Grant":{counties:["washington"],ami:115,fg:true},
"City of Woodbury First-Time Homeownership Program":{cities:["woodbury"],ft:true,edu:true,income:()=>158000,price:451500,verify:["Apply at least 35 days before closing"]},
"Scott County CDA First-Time Homebuyer Grant":{counties:["scott"],ft:true,edu:true,verify:["CDA 1-on-1 counseling 60+ days before offer"]},
"Dakota County CDA DPA (Northfield)":{cities:["northfield"]},
"One Roof Essentia Hillside Incentive Program (HHIP)":{cities:["duluth"],edu:true,verify:["Central Hillside neighborhood map"]},
"One Roof Impact DPA":{cities:["duluth"],income:()=>93500,edu:true,verify:["One Roof service area"]},
"First Homes (Rochester) community land trust":{counties:["olmsted"],income:()=>106800,verify:["CLT home, not cash DPA"]},
"Associated Bank PATH Grant":{counties:["anoka","chisago","dakota","hennepin","ramsey","scott","washington","olmsted","goodhue"],verify:["credit and debt rules follow the first mortgage"]},
};
function evaluate(p,b){
 const r=RULES[p.name]||{},fail=[],ver=[...(r.verify||[])];
 const city=(b.city||"").toLowerCase().trim(),county=(b.county||"").toLowerCase().replace(/ county$/,"").trim();
 if(r.closed)fail.push("This program doesn't have funds to reserve right now. Check its page for the latest, or get the MN DPA Update when something changes.");
 if(r.counties&&!r.counties.includes(county))fail.push("This program only covers "+p.geography.split(" (")[0]+", so it doesn't apply to this area.");
 if(r.cities&&!r.cities.includes(city)&&!(r.counties&&r.counties.includes(county)&&!city))fail.push("This program is only for homes in "+r.cities[0].replace(/\b\w/g,c=>c.toUpperCase())+".");
 if(r.exclCities&&r.exclCities.includes(city))fail.push(b.city.replace(/\b\w/g,c=>c.toUpperCase())+" isn't included in this program because that city runs its own programs.");
 const ic=incomeCheck(p,{...b,county});if(ic.over)fail.push(ic.text);else if(ic.unk)ver.push("Income limit: ask lender");
 if(r.minCredit){if(b.credit<r.minCredit)fail.push(`This program needs a credit score of at least ${r.minCredit}; you said yours is about ${b.credit}.`);}else ver.push("Min credit score");
 if(r.maxDTI){if(b.dti>r.maxDTI)fail.push(`Your total monthly debts would be ${b.dti}% of income; this program allows up to ${r.maxDTI}%.`);}else ver.push("Max DTI");
 if(r.maxLTV){if(b.ltv>r.maxLTV)fail.push(`This program lends up to ${r.maxLTV}% of the home value.`);}else ver.push("Max LTV/CLTV");
 if(r.minHR&&b.hr<r.minHR)fail.push(`This program is for buyers whose house payment is at least ${r.minHR}% of gross monthly income; yours would be about ${Math.round(b.hr)}%. It's aimed at people stretching to afford a home.`);
 if(r.maxHRif&&b.ltv>95&&b.hr>r.maxHRif)fail.push(`With less than 5% down, this loan allows a house payment up to ${r.maxHRif}% of gross monthly income; yours would be about ${Math.round(b.hr)}%.`);
 if(r.price&&b.price>r.price)fail.push(`This program caps the price at $${r.price.toLocaleString("en-US")}; your estimated price is about $${Math.round(b.price).toLocaleString("en-US")}.`);
 if(!r.price)ver.push("Purchase price limit: "+p.purchase_price_limit);
 if(r.ft&&!b.ft)fail.push("This program is for buyers who haven't owned a home in the last 3 years; you said you have.");
 if(r.fg&&!b.fg)fail.push("This program is for first-generation buyers (you and your parents never owned a home); you said that doesn't apply to you.");
 if(r.ftOrFg&&!b.ft&&!b.fg)fail.push("This program is for first-time or first-generation buyers; you said neither applies.");
 if((r.edu||(r.eduIfFt&&b.ft))&&!b.edu)ver.push("Homebuyer education must be completed");
 if(/limited|not stated|verify|subject/i.test(p.funding_status))ver.push("Funding availability");
 const cat=fail.length?"Not eligible":ver.length>(r.verify||[]).length+3||!Object.keys(r).length?"Possibly eligible":ver.length?"Possibly eligible":"Likely eligible";
 return {cat,fail,ver};
}
if(typeof module!=="undefined")module.exports={evaluate,RULES};

// HUD FY2026 limits (HOME Program table, effective 6/1/2026, huduser.gov) — index = household size-1
const HUD={
 metro:{60:[55260,63120,71040,78900,85260,91560,97860,104160],80:[73650,84200,94700,105200,113650,122050,130450,138900]},
 rochester:{60:[57060,65220,73380,81480,88020,94560,101040,107580],80:[74800,85450,96150,106800,115350,123900,132450,141000]},
 stcloud:{60:[45000,51420,57840,64260,69420,74580,79740,84840],80:[60000,68600,77150,85700,92600,99450,106300,113150]},
 duluth:{60:[42480,48540,54600,60660,65520,70380,75240,80100],80:[56650,64750,72850,80900,87400,93850,100350,106800]},
 goodhue:{80:[63950,73050,82200,91300,98650,105950,113250,120550]},
 mankato:{60:[44760,51120,57540,63900,69060,74160,79260,84360],80:[59650,68200,76700,85200,92050,98850,105650,112500]}};
const HUDAREA={hennepin:"metro",ramsey:"metro",anoka:"metro",carver:"metro",dakota:"metro",scott:"metro",washington:"metro",chisago:"metro",isanti:"metro",sherburne:"metro",wright:"metro",
 olmsted:"rochester",dodge:"rochester",stearns:"stcloud",benton:"stcloud","st. louis":"duluth",carlton:"duluth",goodhue:"goodhue","blue earth":"mankato",nicollet:"mankato"};
function hudLimit(pct,b){const a=HUDAREA[b.county];if(!a||!HUD[a][pct])return null;return HUD[a][pct][Math.min(Math.max(b.hh,1),8)-1];}
// incomeBasis: 'qualifying' | 'household' | 'mnh' (borrowers + resident spouse/occupant co-signer) | 'unclear'
// limitType: 'program' (fixed program limit) | 'hud' (HUD AMI % by size/area) | 'unknown'
const INC={
 "MN Housing Start Up (first mortgage)":{basis:"mnh",type:"program",lim:b=>startUpLim(b),label:"Minnesota Housing limit"},
 "MN Housing Step Up (first mortgage)":{basis:"mnh",type:"program",lim:b=>stepUpLim(b),label:"Minnesota Housing limit"},
 "MN Housing Monthly Payment Loan (MPL)":{basis:"mnh",type:"program",lim:b=>b.ft?startUpLim(b):stepUpLim(b),label:"Minnesota Housing limit"},
 "MN Housing Deferred Payment Loan (DPL)":{basis:"mnh",type:"program",lim:dplLim,label:"Minnesota Housing DPL limit"},
 "MN Housing Deferred Payment Loan Plus (DPL+)":{basis:"mnh",type:"program",lim:dplLim,label:"Minnesota Housing DPL limit"},
 "First-Generation Homebuyers Community DPA Fund":{basis:"mnh",type:"program",lim:()=>118900,label:"program limit"},
 "Hennepin County Homebuyer Assistance (DPA)":{basis:"unclear",type:"hud",pct:80,label:"80% HUD AMI limit"},
 "Saint Paul Citywide Downpayment Assistance (incl. First Gen layer)":{basis:"unclear",type:"hud",pct:80,label:"80% HUD AMI limit"},
 "Southern Ridge Twin Homes DPA":{basis:"household",type:"hud",pct:80,label:"80% HUD AMI limit (Stearns)"},
 "Carver County CDA Standard DPA":{basis:"unclear",type:"program",lim:()=>131500,label:"100% AMI limit, any household size"},
 "Carver County CDA First-Generation Set-Aside DPA":{basis:"unclear",type:"program",lim:()=>131500,label:"100% AMI limit, any household size"},
 "One Roof Impact DPA":{basis:"unclear",type:"program",lim:()=>93500,label:"program limit"},
 "City of Woodbury First-Time Homeownership Program":{basis:"household",type:"program",lim:()=>158000,label:"$158,000 household income limit"},
 "Associated Bank PATH Grant":{basis:"qualifying",type:"path",label:"PATH 80% AMI limit"},
 "First Homes (Rochester) community land trust":{basis:"household",type:"program",lim:()=>106800,label:"80% AMI limit (Olmsted/Dodge)"}
};
const PATHLIM={anoka:[105360,131700],chisago:[105360,131700],dakota:[105360,131700],hennepin:[105360,131700],ramsey:[105360,131700],scott:[105360,131700],washington:[105360,131700],olmsted:[96240,120300],goodhue:[89200,111500]};
function incomeCheck(p,b){const c=INC[p.name];
 if(c&&c.type=="path"){const L=PATHLIM[b.county],q=b.qual??b.income,f=n=>"$"+Math.round(n).toLocaleString("en-US");if(!L)return {unk:true,text:"Income limit: ask a participating lender"};
  if(q<L[0])return {text:`Qualifying income fits (under the ${f(L[0])} PATH limit)`,L};
  if(q<=L[1])return {mid:true,text:`May qualify if the home is in a low-to-moderate income area - ask a participating lender (income is over ${f(L[0])} but within ${f(L[1])})`,L};
  return {over:true,text:`Your qualifying income is about ${f(Math.ceil((q-L[1])/1000)*1000)} over PATH's highest limit of ${f(L[1])} (100% of area median income, for homes in low-to-moderate income areas).`,L};}const f=n=>"$"+Math.round(n).toLocaleString("en-US");
 if(!c)return {unk:true,text:"Income limit: ask lender"};
 const L=c.type=="hud"?hudLimit(c.pct,b):c.lim(b);if(!L)return {unk:true,text:"Income limit: ask lender"};
 const q=b.qual??b.income,h=b.hhinc??b.income;
 const inc=c.basis=="household"?h:q, who=c.basis=="household"?"Household income":c.basis=="qualifying"?"Qualifying income":c.basis=="mnh"?"Income (borrowers + spouse)":"Income";
 if(c.basis=="unclear"){if(q>L)return {over:true,text:`Your income is about ${f(Math.ceil((q-L)/1000)*1000)} over this program's ${f(L)} limit`+(c.type=="hud"?` (${c.pct}% of area median income for ${b.hh} ${b.hh==1?"person":"people"}).`:` (${c.label}).`)};
   if(h>L)return {text:`Qualifying income fits, household is over the ${c.label} (${f(L)}) — confirm with lender which counts`};
   return {text:`Income fits (${c.label}: ${f(L)}) — confirm with lender which income counts`};}
 if(inc>L){const nm=c.basis=="household"?"household income":c.basis=="mnh"?"income (people on the loan plus a spouse living with you)":"income";
  const why=c.type=="hud"?` (${c.pct}% of area median income for ${b.hh} ${b.hh==1?"person":"people"})`:c.label=="program limit"?"":` (${c.label})`;
  return {over:true,text:`Your ${nm} is about ${f(Math.ceil((inc-L)/1000)*1000)} over this program's ${f(L)} limit${why}.`};}
 return {text:`${who} fits (${c.label}: ${f(L)})`+(c.basis=="mnh"?" — add a non-borrowing spouse's income if any":"")};}
function incomeVerdict(p,b){return incomeCheck(p,{...b,county:(b.county||"").toLowerCase()}).text;}
function programIncomeLimit(p,b){
 const c=INC[p.name]; if(!c) return null;
 const bb={...b,county:(b.county||"").toLowerCase().replace(/ county$/,"")};
 if(c.type==="path"){const L=PATHLIM[bb.county]; return L?L[1]:null;}
 const L=c.type==="hud"?hudLimit(c.pct,bb):c.lim(bb);
 return L||null;
}
if(typeof module!=="undefined")Object.assign(module.exports,{incomeVerdict,incomeCheck,INC,programIncomeLimit});
