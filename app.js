/* =========================================================
   Global Renewable Electricity Dashboard — app.js (version 3)
   Data: Our World in Data, "Electricity generation from renewables" (TWh)
   Public, non-personal data. Static site — no server needed.

   The data file is stored INSIDE this repository, next to this file:
     electricity-renewables.csv
   Loading a file from the same website cannot be blocked by CORS
   and does not depend on OWID being online.
   ========================================================= */

const APP_VERSION = "v3";

/* Tried in this order. The first one that works is used. */
const DATA_SOURCES = [
  {
    label: "Local file in this repository",
    url: "electricity-renewables.csv?v=" + APP_VERSION
  },
  {
    label: "OWID live CSV",
    url: "https://ourworldindata.org/grapher/electricity-renewables.csv?v=1&csvType=full&useColumnShortNames=false"
  },
  {
    label: "OWID energy data on GitHub",
    url: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"
  }
];

let rows = [];     // cleaned rows: { Entity, Code, Year, value }
let entities = [];
let years = [];

const $ = id => document.getElementById(id);

const fmt = n =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

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
  const find = names => headers.find(h => names.includes(h.toLowerCase()));

  const entityCol = find(["entity", "country"]);
  const codeCol = find(["code", "iso_code"]);
  const yearCol = find(["year"]);

  let valueCol = find([
    "renewables",
    "renewables_electricity",
    "renewable_generation__twh"
  ]);
  if (!valueCol) {
    /* Fall back to the first column that isn't Entity / Code / Year */
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
    }).filter(r => r.Entity && Number.isFinite(r.Year) && Number.isFinite(r.value));
}


/* Try each data source in turn; record exactly why each one failed */
async function loadData() {
  const problems = [];

  for (const source of DATA_SOURCES) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("HTTP " + response.status + " (file missing or server error)");
      }

      const text = await response.text();

      if (/^\s*</.test(text)) {
        throw new Error("received a web page instead of a CSV file");
      }

      const clean = normalise(parseCSV(text));

      if (!clean.length) {
        const firstLine = text.split("\n")[0].slice(0, 120);
        throw new Error("CSV had no usable rows. First line was: " + firstLine);
      }

      console.log("Loaded data from:", source.label, "-", clean.length, "rows");
      return { rows: clean, source: source.label };

    } catch (err) {
      /* A CORS block shows up here as "Failed to fetch" / "Load failed" */
      const reason =
        err instanceof TypeError
          ? "blocked by the browser (network or CORS): " + err.message
          : err.message;
      problems.push(source.label + ": " + reason);
      console.warn(source.label, "failed:", reason);
    }
  }

  const error = new Error("All data sources failed.");
  error.details = problems;
  throw error;
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

  /* Only real countries (3-letter ISO codes); aggregates such as
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


function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}


/* Build the dashboard */
async function init() {
  try {
    if (typeof Plotly === "undefined") {
      throw new Error("The Plotly chart library did not load (cdn.plot.ly).");
    }

    const loaded = await loadData();
    rows = loaded.rows;

    entities = [...new Set(rows.map(r => r.Entity))].sort();
    years = [...new Set(rows.map(r => r.Year))].sort((a, b) => a - b);

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

    fillSelect($("startYear"), years, [Math.max(years[0], 2000)]);
    fillSelect($("compareYear"), years, [latest.Year]);

    const defaults = ["China", "United States", "Brazil", "India"].filter(
      country => entities.includes(country)
    );
    fillSelect($("countries"), entities, defaults);

    $("startYear").addEventListener("change", drawGlobal);
    $("compareYear").addEventListener("change", () => {
      drawCountries();
      drawMap();
    });
    $("countries").addEventListener("change", drawCountries);

    drawGlobal();
    drawCountries();
    drawMap();

  } catch (error) {
    console.error(error);

    const details = (error.details || [])
      .map(d => "<li>" + escapeHTML(d) + "</li>")
      .join("");

    document.querySelectorAll(".chart").forEach(el => {
      el.innerHTML = `
        <div style="padding:30px; color:#9b2c2c;">
          The dashboard data could not be loaded (dashboard ${APP_VERSION}).
          <br><br>
          ${escapeHTML(error.message)}
          ${details ? "<ul style='margin-top:10px'>" + details + "</ul>" : ""}
        </div>
      `;
    });
  }
}

init();
