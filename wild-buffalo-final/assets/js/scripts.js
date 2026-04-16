
//Map

window.initMap = function () {

    const location = { lat: 36.0260, lng: -93.3652 };

    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 14,
        center: location,
        mapId: "1f3f85a0a84832a6e03de024"
    });

    const markerContent = document.createElement("div");

    markerContent.innerHTML = `
        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
        ">
            <img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png">
            <div style="
                background:white;
                padding:4px 10px;
                border-radius:12px;
                margin-top:4px;
                font-weight:bold;
                color:#2e7d32;
                box-shadow:0 2px 6px rgba(0,0,0,0.3);
                white-space:nowrap;
            ">
                Nature's Elk Outfitters
            </div>
        </div>
    `;

    new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: location,
        content: markerContent
    });
};





// River JS

const sites = {
  "USGS-07055660": "Ponca",
  "USGS-07055646": "Boxley",
  "USGS-07055680": "Pruitt"
};

let chart;
let currentIndex = 0;
const siteIds = Object.keys(sites);

// API
function buildUrl(siteId) {
  return `https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?monitoring_location_id=${siteId}&parameter_code=00065&time=P14D&limit=5000&api_key=DEMO_KEY`;
}

// =========================
// STAGE RULES
// =========================
const stageRules = {
  "USGS-07055646": [
    { label: "Very Low", className: "very-low", max: 2.0 },
    { label: "Low / Floatable", className: "low", max: 2.4 },
    { label: "Moderate / Ample", className: "moderate", max: 4.9 },
    { label: "High", className: "high", max: 6.0 },
    { label: "Flood Stage", className: "flood", max: Infinity }
  ],

  "USGS-07055660": [
    { label: "Very Low", className: "very-low", max: 2.0 },
    { label: "Low / Floatable", className: "low", max: 2.4 },
    { label: "Moderate / Ample", className: "moderate", max: 4.9 },
    { label: "High", className: "high", max: 6.0 },
    { label: "Flood Stage", className: "flood", max: Infinity }
  ],

  "USGS-07055680": [
    { label: "Very Low", className: "very-low", max: 4.4 },
    { label: "Low / Floatable", className: "low", max: 4.7 },
    { label: "Moderate / Ample", className: "moderate", max: 6.6 },
    { label: "High", className: "high", max: 8.0 },
    { label: "Flood Stage", className: "flood", max: Infinity }
  ]
};

// =========================
// FLOAT RANGE (CLEAR VISUAL ZONE)
// =========================
const floatRanges = {
  "USGS-07055646": { low: 2.5, high: 4.9 },
  "USGS-07055660": { low: 2.5, high: 4.9 },
  "USGS-07055680": { low: 4.8, high: 6.6 }
};

// Stage
function getStage(siteId, value) {
  if (value == null) return { label: "No Data", className: "very-low" };

  const rules = stageRules[siteId];

  for (const rule of rules) {
    if (value <= rule.max) {
      return { label: rule.label, className: rule.className };
    }
  }

  return { label: "Unknown", className: "very-low" };
}

// Trend
function getTrend(values) {
  if (values.length < 2) return "Data unavailable";
  const last = values.at(-1);
  const prev = values.at(-2);

  if (last > prev) return "Rising";
  if (last < prev) return "Falling";
  return "Stable";
}

// Fetch
async function fetchData(siteId) {
  const res = await fetch(buildUrl(siteId));
  const json = await res.json();

  const raw = [];

  json.features.forEach(f => {
    const p = f.properties;
    const val = parseFloat(p.value);

    if (!isNaN(val) && p.time) {
      raw.push({
        time: new Date(p.time),
        value: val
      });
    }
  });

  raw.sort((a, b) => a.time - b.time);

  return {
    labels: raw.map(p => p.time.toLocaleDateString()),
    values: raw.map(p => p.value)
  };
}

// Cards
function createCards() {
  const container = document.getElementById("cards");

  siteIds.forEach((siteId, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;

    card.innerHTML = `
      <h3>${sites[siteId]}</h3>
      <p class="status">Loading...</p>
      <p class="level"></p>
    `;

    card.onclick = () => selectRiver(index);

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") selectRiver(index);
    });

    container.appendChild(card);

    fetchData(siteId).then(data => {
      const values = data.values;
      const lastValue = values.length ? values.at(-1) : null;

      const stage = getStage(siteId, lastValue);
      const trend = getTrend(values);

      card.classList.add(stage.className);

      card.querySelector(".status").textContent =
        `${stage.label} — ${trend}`;

      card.querySelector(".level").textContent =
        lastValue != null ? `${lastValue.toFixed(2)} ft` : "No data";
    });
  });
}

// Select
function selectRiver(index) {
  currentIndex = index;
  loadRiver(siteIds[index]);
}

// Chart
async function loadRiver(siteId) {
  const data = await fetchData(siteId);

  document.getElementById("chartTitle").textContent =
    `${sites[siteId]} River Level`;

  if (chart) chart.destroy();

  const range = floatRanges[siteId];

  const rangeLowLine = {
    label: "FLOAT RANGE (LOW)",
    data: Array(data.values.length).fill(range.low),
    borderWidth: 4,
    borderColor: "rgba(0, 180, 100, 0.95)",
    borderDash: [8, 6],
    pointRadius: 0
  };

  const rangeHighLine = {
    label: "FLOAT RANGE (HIGH)",
    data: Array(data.values.length).fill(range.high),
    borderWidth: 4,
    borderColor: "rgba(0, 180, 100, 0.95)",
    borderDash: [8, 6],
    pointRadius: 0
  };

  chart = new Chart(document.getElementById("riverChart"), {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Water Level (ft)",
          data: data.values,
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 0,
          borderColor: "rgba(30, 90, 200, 0.9)"
        },

        rangeLowLine,
        rangeHighLine
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: {
              weight: "bold"
            }
          }
        }
      }
    }
  });
}

// Keyboard nav
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    currentIndex = (currentIndex + 1) % siteIds.length;
    selectRiver(currentIndex);
  }

  if (e.key === "ArrowLeft") {
    currentIndex = (currentIndex - 1 + siteIds.length) % siteIds.length;
    selectRiver(currentIndex);
  }
});

// Init
createCards();

