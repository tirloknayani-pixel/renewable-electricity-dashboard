const DATA_URL = "https://ourworldindata.org/grapher/electricity-mix.csv?v=1&csvType=full&useColumnShortNames=false&source=renewables&metric=generation&frequency=annual";

let rows = [];
let entities = [];
let years = [];

const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString(undefined,{maximumFractionDigits:2});

function getValue(r){
  const key = Object.keys(r).find(k => k.toLowerCase().includes("electricity generation from renewables"));
  return key ? Number(r[key]) : NaN;
}
function getISO(r){
  const key = Object.keys(r).find(k => k.toLowerCase() === "code");
  return key ? r[key] : "";
}

function fillSelect(select, values, selected=[]){
  select.innerHTML = "";
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v; o.selected = selected.includes(v);
    select.appendChild(o);
  });
}

function selectedCountries(){
  return Array.from($("countries").selectedOptions).map(o=>o.value).slice(0,5);
}

function drawGlobal(){
  const start = Number($("startYear").value);
  const data = rows.filter(r=>r.Entity==="World" && r.Year>=start && Number.isFinite(getValue(r)));
  Plotly.react("globalChart",[{
    x:data.map(r=>r.Year), y:data.map(getValue), mode:"lines", line:{width:3},
    hovertemplate:"%{x}: %{y:,.2f} TWh<extra></extra>"
  }],{
    margin:{l:60,r:20,t:10,b:45}, paper_bgcolor:"white", plot_bgcolor:"white",
    xaxis:{title:"Year"}, yaxis:{title:"Renewable generation (TWh)",rangemode:"tozero"},
    hovermode:"x unified"
  },{responsive:true,displaylogo:false});
}

function drawCountries(){
  const selected = selectedCountries();
  const traces = selected.map(name=>{
    const d = rows.filter(r=>r.Entity===name && Number.isFinite(getValue(r))).sort((a,b)=>a.Year-b.Year);
    return {x:d.map(r=>r.Year),y:d.map(getValue),name,mode:"lines",hovertemplate:`${name}<br>%{x}: %{y:,.2f} TWh<extra></extra>`};
  });
  Plotly.react("countryChart",traces,{
    margin:{l:60,r:20,t:10,b:45},paper_bgcolor:"white",plot_bgcolor:"white",
    xaxis:{title:"Year"},yaxis:{title:"Renewable generation (TWh)",rangemode:"tozero"},
    legend:{orientation:"h",y:-.18}
  },{responsive:true,displaylogo:false});
}

function drawMap(){
  const year = Number($("compareYear").value);
  const d = rows.filter(r=>r.Year===year && /^[A-Z]{3}$/.test(getISO(r)) && Number.isFinite(getValue(r)));
  Plotly.react("mapChart",[{
    type:"choropleth",locationmode:"ISO-3",
    locations:d.map(getISO),z:d.map(getValue),
    text:d.map(r=>r.Entity),customdata:d.map(getValue),
    colorscale:"Greens",colorbar:{title:"TWh"},
    hovertemplate:"%{text}<br>%{customdata:,.2f} TWh<extra></extra>"
  }],{
    margin:{l:0,r:0,t:0,b:0},geo:{showframe:false,showcoastlines:true,projection:{type:"natural earth"}}
  },{responsive:true,displaylogo:false});
}

async function init(){
  try{
    const res = await fetch(DATA_URL);
    if(!res.ok) throw new Error("Could not load OWID CSV");
    const csv = await res.text();
    const parsed = Papa.parse(csv,{header:true,skipEmptyLines:true});
    rows = parsed.data.filter(r=>r.Entity && r.Year && Number.isFinite(getValue(r)));
    entities = [...new Set(rows.map(r=>r.Entity))].sort();
    years = [...new Set(rows.map(r=>Number(r.Year)))].sort((a,b)=>a-b);

    const world = rows.filter(r=>r.Entity==="World").sort((a,b)=>a.Year-b.Year);
    const latest = world[world.length-1];
    $("globalLatest").textContent = fmt(getValue(latest))+" TWh";
    $("globalLatestYear").textContent = "World • "+latest.Year;
    $("latestYear").textContent = latest.Year;
    $("entityCount").textContent = entities.length;

    fillSelect($("startYear"),years, [Math.max(years[0],2000)]);
    fillSelect($("compareYear"),years,[latest.Year]);
    const defaults = ["China","United States","Brazil","India"].filter(x=>entities.includes(x));
    fillSelect($("countries"),entities,defaults);

    $("startYear").addEventListener("change",drawGlobal);
    $("compareYear").addEventListener("change",()=>{drawCountries();drawMap()});
    $("countries").addEventListener("change",drawCountries);

    drawGlobal(); drawCountries(); drawMap();
  }catch(err){
    document.querySelectorAll(".chart").forEach(el=>el.innerHTML=`<div style="padding:30px;color:#9b2c2c">Unable to load the public OWID dataset. Check your internet connection and reload the page.<br><br>${err.message}</div>`);
  }
}
init();
