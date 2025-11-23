const q = document.getElementById("q");
const suggestBox = document.getElementById("suggest");
const unitToggle = document.getElementById("unitToggle");
const locBtn = document.getElementById("locBtn");

let useF = false;

/* ----------------------- EVENT BINDINGS ---------------------- */

// Search button
document.getElementById("searchBtn").onclick = searchCity;

// Enter key on search box
q.addEventListener("keydown", e => {
  if (e.key === "Enter") searchCity();
});

// Unit toggle °C/°F
unitToggle.onchange = () => {
  useF = unitToggle.checked;
  if (window.lastCity) searchCity(window.lastCity);
};

// Use My Location
locBtn.onclick = () => {
  navigator.geolocation.getCurrentPosition(
    pos => loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "Your location"),
    () => alert("Unable to access your location")
  );
};

// Autocomplete
let autoTimeout;
q.oninput = () => {
  clearTimeout(autoTimeout);
  autoTimeout = setTimeout(loadSuggestions, 200);
};

/* ----------------------- AUTOCOMPLETE ---------------------- */

async function loadSuggestions() {
  const name = q.value.trim();
  if (!name) return (suggestBox.hidden = true);

  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}`);
  const j = await r.json();

  if (!j.results) return (suggestBox.hidden = true);

  suggestBox.innerHTML = "";
  suggestBox.hidden = false;

  j.results.slice(0, 5).forEach(c => {
    const d = document.createElement("div");
    d.textContent = `${c.name}, ${c.country}`;
    d.onclick = () => {
      q.value = c.name;
      suggestBox.hidden = true;
      searchCity(c.name);
    };
    suggestBox.appendChild(d);
  });
}

/* ----------------------- MAIN SEARCH ---------------------- */

async function searchCity(forceName = null) {
  const name = forceName || q.value.trim();
  if (!name) return;

  suggestBox.hidden = true;
  window.lastCity = name;

  // 1) Geocoding
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}`);
  const g = await geo.json();

  if (!g.results) return alert("City not found");

  const { latitude, longitude, name: city, country } = g.results[0];

  loadWeatherByCoords(latitude, longitude, `${city}, ${country}`);
}

/* ----------------------- FETCH WEATHER ---------------------- */

async function loadWeatherByCoords(lat, lon, label) {
  const w = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset` +
      `&hourly=temperature_2m,weather_code,is_day` +
      `&timezone=auto`
  );

  const j = await w.json();

  displayCurrent(label, j);
  displayHourly(j);
  displayDaily(j);
}

/* ----------------------- HELPERS ---------------------- */

function cToF(c) {
  return (c * 9) / 5 + 32;
}

function formatTime(t) {
  const date = new Date(t);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ----------------------- RENDER — CURRENT ---------------------- */

function displayCurrent(label, j) {
  const cur = j.current;
  let temp = cur.temperature_2m;
  if (useF) temp = cToF(temp);

  document.getElementById("place").textContent = label;
  document.getElementById("temp").textContent = Math.round(temp) + "°";
  document.getElementById("desc").textContent = weatherText(cur.weather_code);
  document.getElementById("meta").textContent =
    `Humidity ${cur.relative_humidity_2m}% · Wind ${cur.wind_speed_10m} km/h`;
  document.getElementById("icon").textContent = icon(cur.weather_code);
  document.getElementById("time").textContent = formatTime(cur.time);
  document.getElementById("updated").textContent = "Last: " + new Date().toLocaleTimeString();
}

/* ----------------------- RENDER — HOURLY ---------------------- */

function displayHourly(j) {
  const box = document.getElementById("hourly");
  box.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    let t = j.hourly.temperature_2m[i];
    if (useF) t = cToF(t);

    const div = document.createElement("div");
    div.className = "hour";
    div.innerHTML = `
      <div>${formatTime(j.hourly.time[i])}</div>
      <div style="font-size:18px">${Math.round(t)}°</div>
      <div>${icon(j.hourly.weather_code[i])}</div>
    `;
    box.appendChild(div);
  }
}

/* ----------------------- RENDER — DAILY ---------------------- */

function displayDaily(j) {
  const box = document.getElementById("days");
  box.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    let max = j.daily.temperature_2m_max[i];
    let min = j.daily.temperature_2m_min[i];
    if (useF) {
      max = cToF(max);
      min = cToF(min);
    }

    const row = document.createElement("div");
    row.className = "day";
    row.innerHTML = `
      <div>${j.daily.time[i]}</div>
      <div>${icon(j.daily.weather_code[i])}</div>
      <div>${Math.round(min)}° / ${Math.round(max)}°</div>
    `;
    box.appendChild(row);
  }

  document.getElementById("extras").textContent =
    `Sunrise: ${j.daily.sunrise[0].slice(11, 16)} · Sunset: ${j.daily.sunset[0].slice(11, 16)}`;
}

/* ----------------------- WEATHER CODE → TEXT ---------------------- */

function weatherText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Snowfall",
    73: "Snow",
    75: "Heavy snow",
    95: "Thunderstorm",
    96: "Thunderstorm + hail"
  };
  return map[code] || "Weather";
}

/* ----------------------- WEATHER CODE → EMOJI ---------------------- */

function icon(code) {
  const map = {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    45: "🌫️",
    48: "🌁",
    51: "🌦️",
    61: "🌧️",
    63: "🌧️",
    65: "🌧️",
    71: "❄️",
    75: "❄️",
    95: "⛈️",
    96: "⛈️"
  };
  return map[code] || "🌡️";
}
