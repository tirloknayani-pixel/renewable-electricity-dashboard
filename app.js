/* =========================================================
   Global Renewable Electricity Dashboard — app.js
   Data: Our World in Data (public, non-personal)
   Works as a static GitHub Pages site. No server needed.
   ========================================================= */

/* Main data source (OWID "Electricity generation from renewables", TWh).
   Columns: Entity, Code, Year, Renewables */
const DATA_URL =
  "https://ourworldindata.org/grapher/electricity-renewables.csv?v=1&csvType=full&useColumnShortNames=false";

/* Backup data source (OWID energy dataset on GitHub), used only if the
   main source fails. Columns used: country, iso_code, year, renewables_electricity */
const BACKUP_URL =
  "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv";

let rows = [];     // cleaned rows: { Entity, Code, Year, value }
let entities = [];
let years = [];

const $ = id => document.getElementById(id);

const fmt = n =>
  Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });

function getValue(r) {
  return r.value;
}

function getISO(r) {
  return r.Code || "";
}


/* CSV parser — no external library required */
function parseCSV(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        lines.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    lines.push(row);
  }

  if (!lines.length) return [];

  const headers = lines[0].map(h => h.trim().replace(/^\uFEFF/, ""));

  return lines
    .slice(1)
    .filter(r => r.some(v => v !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    });
}


/* Turn raw CSV rows into clean rows, whatever the column names are */
function normalise(parsed) {
  if (!parsed.length) return [];

  const headers = Object.keys(parsed[0]);
  const find = names =>
    headers.find(h => names.includes(h.toLowerCase()));

  const entityCol = find(["entity", "country"]);
  const codeCol = find(["code", "iso_code"]);
  const yearCol = find(["year"]);

  /* Value column: "Renewables" (main source) or "renewables_electricity"
     (backup). Otherwise, use the first column that isn't Entity/Code/Year. */
  let valueCol = find([
    "renewables",
    "renewables_electricity",
    "renewable_generation__twh"
  ]);
  if (!valueCol) {
    valueCol = headers.find(
      h => h !== entityCol && h !== codeCol && h !== yearCol
    );
  }

  if (!entityCol || !yearCol || !valueCol) return [];

  return parsed
    .map(r => ({
      Entity: String(r[entityCol] || "").trim(),
      Code: codeCol ? String(r[codeCol] || "").trim() : "",
      Year: Number(r[yearCol]),
      value: r[valueCol] === "" ? NaN : Number(r[valueCol])
    }))
    .filter(
      r =>
        r.Entity &&
        Number.isFinite(r.Year) &&
        Number.isFinite(r.value) &&
        /* Skip duplicate source-specific groupings such as
           "Africa (EI)" or "Europe (Ember)" — they have no code. */
        r.Code !== ""
    );
}


async function loadData() {
  const sources = [DATA_URL, BACKUP_URL];
  let lastError = null;

  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("OWID returned error " + response.status);
      }
      const csv = await response.text();
      const clean = normalise(parseCSV(csv));
      if (clean.length) return clean;
      throw new Error("No usable data was found in the OWID dataset.");
    } catch (err) {
      lastError = err;
      console.warn("Data source failed:", url, err);
    }
  }

  throw lastError || new Error("Could not load OWID data.");
}


function fillSelect(select, values, selected = []) {
  select.innerHTML = "";
  const chosen = selected.map(String);

  values.forEach(v => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    option.selected = chosen.includes(String(v));
    select.appendChild(option);
  });
}


function selectedCountries() {
  return Array.from($("countries").selectedOptions)
    .map(o => o.value)
    .slice(0, 5);
}


/* Global trend chart */
function drawGlobal() {
  const start = Number($("startYear").value);

  const data = rows
    .filter(r => r.Entity === "World" && r.Year >= start)
    .sort((a, b) => a.Year - b.Year);

  Plotly.react(
    "globalChart",
    [
      {
        x: data.map(r => r.Year),
        y: data.map(getValue),
        mode: "lines",
        line: { width: 3 },
        hovertemplate: "%{x}: %{y:,.2f} TWh<extra></extra>"
      }
    ],
    {
      margin: { l: 60, r: 20, t: 10, b: 45 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      xaxis: { title: "Year" },
      yaxis: { title: "Renewable generation (TWh)", rangemode: "tozero" },
      hovermode: "x unified"
    },
    { responsive: true, displaylogo: false }
  );
}


/* Country comparison chart */
function drawCountries() {
  const selected = selectedCountries();

  const traces = selected.map(name => {
    const data = rows
      .filter(r => r.Entity === name)
      .sort((a, b) => a.Year - b.Year);

    return {
      x: data.map(r => r.Year),
      y: data.map(getValue),
      name: name,
      mode: "lines",
      hovertemplate: `${name}<br>%{x}: %{y:,.2f} TWh<extra></extra>`
    };
  });

  Plotly.react(
    "countryChart",
    traces,
    {
      margin: { l: 60, r: 20, t: 10, b: 45 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      xaxis: { title: "Year" },
      yaxis: { title: "Renewable generation (TWh)", rangemode: "tozero" },
      legend: { orientation: "h", y: -0.18 }
    },
    { responsive: true, displaylogo: false }
  );
}


/* Country map */
function drawMap() {
  const year = Number($("compareYear").value);

  /* Only real countries (3-letter ISO codes); regions like
     "OWID_WRL" or "OWID_EUR" are left off the map. */
  const data = rows.filter(
    r => r.Year === year && /^[A-Z]{3}$/.test(getISO(r))
  );

  Plotly.react(
    "mapChart",
    [
      {
        type: "choropleth",
        locationmode: "ISO-3",
        locations: data.map(getISO),
        z: data.map(getValue),
        text: data.map(r => r.Entity),
        customdata: data.map(getValue),
        colorscale: "Greens",
        colorbar: { title: "TWh" },
        hovertemplate: "%{text}<br>%{customdata:,.2f} TWh<extra></extra>"
      }
    ],
    {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      geo: {
        showframe: false,
        showcoastlines: true,
        projection: { type: "natural earth" }
      }
    },
    { responsive: true, displaylogo: false }
  );
}


/* Load public OWID data and build the dashboard */
async function init() {
  try {
    rows = await loadData();

    entities = [...new Set(rows.map(r => r.Entity))].sort();
    years = [...new Set(rows.map(r => r.Year))].sort((a, b) => a - b);

    /* Latest global value */
    const world = rows
      .filter(r => r.Entity === "World")
      .sort((a, b) => a.Year - b.Year);

    if (!world.length) {
      throw new Error("The dataset has no 'World' rows.");
    }

    const latest = world[world.length - 1];

    $("globalLatest").textContent = fmt(getValue(latest)) + " TWh";
    $("globalLatestYear").textContent = "World • " + latest.Year;
    $("latestYear").textContent = latest.Year;
    $("entityCount").textContent = entities.length;

    /* Start-year selector (defaults to 2000) */
    fillSelect($("startYear"), years, [Math.max(years[0], 2000)]);

    /* Comparison-year selector (defaults to latest world year) */
    fillSelect($("compareYear"), years, [latest.Year]);

    /* Default countries */
    const defaults = ["China", "United States", "Brazil", "India"].filter(
      country => entities.includes(country)
    );
    fillSelect($("countries"), entities, defaults);

    /* Event listeners */
    $("startYear").addEventListener("change", drawGlobal);
    $("compareYear").addEventListener("change", () => {
      drawCountries();
      drawMap();
    });
    $("countries").addEventListener("change", drawCountries);

    /* Draw charts */
    drawGlobal();
    drawCountries();
    drawMap();

  } catch (error) {
    console.error(error);
    document.querySelectorAll(".chart").forEach(el => {
      el.innerHTML = `
        <div style="padding:30px; color:#9b2c2c;">
          Unable to load the public OWID dataset.
          Check your internet connection and reload the page.
          <br><br>
          ${error.message}
        </div>
      `;
    });
  }
}


/* Start dashboard */
init();
