const DATA_URL = "https://ourworldindata.org/grapher/electricity-mix.csv?v=1&csvType=full&useColumnShortNames=true&source=renewables&metric=generation&frequency=annual";
let rows = [];
let entities = [];
let years = [];

const $ = id => document.getElementById(id);

const fmt = n =>
  Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });

function getValue(r) {
  return Number(r["renewable_generation__twh"]);
}

function getISO(r) {
  const key = Object.keys(r).find(
    k => k.toLowerCase() === "code"
  );

  return key ? r[key] : "";
}


/* CSV parser — no external Papa Parse library required */
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

  const headers = lines[0].map(h => h.trim());

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


function fillSelect(select, values, selected = []) {
  select.innerHTML = "";

  values.forEach(v => {
    const option = document.createElement("option");

    option.value = v;
    option.textContent = v;
    option.selected = selected.includes(v);

    select.appendChild(option);
  });
}


function selectedCountries() {
  return Array.from(
    $("countries").selectedOptions
  )
    .map(o => o.value)
    .slice(0, 5);
}


/* Global trend chart */
function drawGlobal() {
  const start = Number($("startYear").value);

  const data = rows.filter(
    r =>
      r.Entity === "World" &&
      Number(r.Year) >= start &&
      Number.isFinite(getValue(r))
  );

  Plotly.react(
    "globalChart",
    [
      {
        x: data.map(r => r.Year),
        y: data.map(getValue),
        mode: "lines",
        line: {
          width: 3
        },
        hovertemplate:
          "%{x}: %{y:,.2f} TWh<extra></extra>"
      }
    ],
    {
      margin: {
        l: 60,
        r: 20,
        t: 10,
        b: 45
      },

      paper_bgcolor: "white",
      plot_bgcolor: "white",

      xaxis: {
        title: "Year"
      },

      yaxis: {
        title: "Renewable generation (TWh)",
        rangemode: "tozero"
      },

      hovermode: "x unified"
    },
    {
      responsive: true,
      displaylogo: false
    }
  );
}


/* Country comparison chart */
function drawCountries() {
  const selected = selectedCountries();

  const traces = selected.map(name => {
    const data = rows
      .filter(
        r =>
          r.Entity === name &&
          Number.isFinite(getValue(r))
      )
      .sort((a, b) => a.Year - b.Year);

    return {
      x: data.map(r => r.Year),
      y: data.map(getValue),
      name: name,
      mode: "lines",

      hovertemplate:
        `${name}<br>%{x}: %{y:,.2f} TWh<extra></extra>`
    };
  });

  Plotly.react(
    "countryChart",
    traces,
    {
      margin: {
        l: 60,
        r: 20,
        t: 10,
        b: 45
      },

      paper_bgcolor: "white",
      plot_bgcolor: "white",

      xaxis: {
        title: "Year"
      },

      yaxis: {
        title: "Renewable generation (TWh)",
        rangemode: "tozero"
      },

      legend: {
        orientation: "h",
        y: -0.18
      }
    },
    {
      responsive: true,
      displaylogo: false
    }
  );
}


/* Country map */
function drawMap() {
  const year = Number($("compareYear").value);

  const data = rows.filter(
    r =>
      Number(r.Year) === year &&
      /^[A-Z]{3}$/.test(getISO(r)) &&
      Number.isFinite(getValue(r))
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

        colorbar: {
          title: "TWh"
        },

        hovertemplate:
          "%{text}<br>%{customdata:,.2f} TWh<extra></extra>"
      }
    ],
    {
      margin: {
        l: 0,
        r: 0,
        t: 0,
        b: 0
      },

      geo: {
        showframe: false,

        showcoastlines: true,

        projection: {
          type: "natural earth"
        }
      }
    },
    {
      responsive: true,
      displaylogo: false
    }
  );
}


/* Load public OWID data */
async function init() {
  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(
        "Could not load OWID CSV"
      );
    }

    const csv = await response.text();

    /* Use built-in parser instead of Papa Parse */
    const parsed = parseCSV(csv);

    rows = parsed.filter(
      r =>
        r.Entity &&
        r.Year &&
        Number.isFinite(getValue(r))
    );

    if (!rows.length) {
      throw new Error(
        "No usable data was found in the OWID dataset."
      );
    }

    entities = [
      ...new Set(
        rows.map(r => r.Entity)
      )
    ].sort();

    years = [
      ...new Set(
        rows.map(r => Number(r.Year))
      )
    ].sort((a, b) => a - b);


    /* Latest global value */
    const world = rows
      .filter(r => r.Entity === "World")
      .sort((a, b) => a.Year - b.Year);

    const latest = world[world.length - 1];


    $("globalLatest").textContent =
      fmt(getValue(latest)) + " TWh";

    $("globalLatestYear").textContent =
      "World • " + latest.Year;

    $("latestYear").textContent =
      latest.Year;

    $("entityCount").textContent =
      entities.length;


    /* Start-year selector */
    fillSelect(
      $("startYear"),
      years,
      [
        Math.max(
          years[0],
          2000
        )
      ]
    );


    /* Comparison-year selector */
    fillSelect(
      $("compareYear"),
      years,
      [latest.Year]
    );


    /* Default countries */
    const defaults = [
      "China",
      "United States",
      "Brazil",
      "India"
    ].filter(
      country =>
        entities.includes(country)
    );

    fillSelect(
      $("countries"),
      entities,
      defaults
    );


    /* Event listeners */
    $("startYear").addEventListener(
      "change",
      drawGlobal
    );

    $("compareYear").addEventListener(
      "change",
      () => {
        drawCountries();
        drawMap();
      }
    );

    $("countries").addEventListener(
      "change",
      drawCountries
    );


    /* Draw charts */
    drawGlobal();

    drawCountries();

    drawMap();

  } catch (error) {

    document
      .querySelectorAll(".chart")
      .forEach(el => {

        el.innerHTML = `
          <div style="
            padding:30px;
            color:#9b2c2c;
          ">
            Unable to load the public OWID dataset.
            Check your internet connection and
            reload the page.
            <br><br>
            ${error.message}
          </div>
        `;

      });
  }
}


/* Start dashboard */
init();
