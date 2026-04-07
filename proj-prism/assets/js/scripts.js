const sites = {
  "USGS-07055660": "Ponca",
  "USGS-07055646": "Boxley",
  "USGS-07055780": "Carver",
  "USGS-07055680": "Pruitt"
};

let chart;
let currentIndex = 0;
const siteIds = Object.keys(sites);

// API
function buildUrl(siteId) {
  return `https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?monitoring_location_id=${siteId}&parameter_code=00065&time=P14D&limit=5000&api_key=DEMO_KEY`;
}

// Stage classification
function getStage(value) {
  if (value == null) return { label: "No Data", className: "very-low" };
  if (value < 1) return { label: "Very Low", className: "very-low" };
  if (value < 3) return { label: "Low", className: "low" };
  if (value < 6) return { label: "Moderate", className: "moderate" };
  if (value < 10) return { label: "High", className: "high" };
  return { label: "Flood Stage", className: "flood" };
}

// Trend
function getTrend(values) {
  if (values.length < 2) return "Data unavailable";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev) return "Rising";
  if (last < prev) return "Falling";
  return "Stable";
}

// Fetch data
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

// Create cards
function createCards() {
  const container = document.getElementById("cards");

  siteIds.forEach((siteId, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("tabindex", "0");

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
      const lastValue = values.length ? values[values.length - 1] : null;

      const stage = getStage(lastValue);
      const trend = getTrend(values);

      card.classList.add(stage.className);

      card.querySelector(".status").textContent =
        `${stage.label} — ${trend}`;

      card.querySelector(".level").textContent =
        lastValue != null
          ? `${lastValue.toFixed(2)} ft`
          : "No data";
    });
  });
}

// Select river
function selectRiver(index) {
  currentIndex = index;
  loadRiver(siteIds[index]);
}

// Load chart
async function loadRiver(siteId) {
  const data = await fetchData(siteId);

  document.getElementById("chartTitle").textContent =
    `${sites[siteId]} River Level`;

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("riverChart"), {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Water Level (ft)",
          data: data.values,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// Keyboard navigation
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