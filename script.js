const q = document.getElementById("q");
const suggestBox = document.getElementById("suggest");
const unitToggle = document.getElementById("unitToggle");

// °C ⇆ °F
let useF = false;

// Search button
document.getElementById("searchBtn").onclick = searchCity;
q.addEventListener("keydown", e => { if (e.key === "Enter") searchCity(); });

// Unit toggle
unitToggle.onchange = () => {
  useF = unitToggle.checked;
  searchCity();
};

// Autocomplete
q.oninput = async () => {
  const name = q.value.trim();
  if (!name) return (suggestBox.hidden = true);

  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${name}`);
  const j = await r.json();
  if (!j.results) return;

  suggestBox.innerHTML = "";
  suggestBox.hidden = false;

  j.results.slice(0, 5).forEach(c => {
    const d = document.createElement("div");
    d.textContent = `${c.name}, ${c.country}`;
    d.onclick = () => {
      q.value = c.name;
      suggestBox.hidden = true;
      searchCity();
    };
    suggestBox.appendChild(d);
  });
};

async function searchCity() {
  const name = q.value.trim();
  if (!name) return;

  suggestBox.hidden = true;

  // 1) Geocoding
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${name}`);
  const g = await geo.json();

  if (!g.results) {
    alert("City not found");
    return;
  }

  const { latitude, longitude, name: city, country } = g.results[0];

  // 2) Weather fetch
  const w = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=temperature_2m,weather_code,is_day&timezone=auto`
  );
  const j = await w.json();

  displayCurrent(city, country, j);
  displayHourly(j);
  displayDaily(j);
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}

function displayCurrent(city, country, j) {
  const cur = j.current;
  let temp = cur.temperature_2m;
  if (useF) temp = cToF(temp);

  document.getElementById("place").textContent = `${city}, ${country}`;
  document.getElementById("temp").textContent = Math.round(temp) + "°";
  document.getElementById("desc").textContent = weatherText(cur.weather_code);
  document.getElementById("meta").textContent =
    `Humidity ${cur.relative_humidity_2m}% · Wind ${cur.wind_speed_10m} km/h`;
  document.getElementById("icon").textContent = icon(cur.weather_code);
  document.getElementById("time").textContent = cur.time;
  document.getElementById("updated").textContent = "Last: " + new Date().toLocaleTimeString();
}

function displayHourly(j) {
  const box = document.getElementById("hourly");
  box.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    let t = j.hourly.temperature_2m[i];
    if (useF) t = cToF(t);

    const div = document.createElement("div");
    div.className = "hour";
    div.innerHTML = `
      <div>${j.hourly.time[i].slice(11)}</div>
      <div style="font-size:18px">${Math.round(t)}°</div>
      <div>${icon(j.hourly.weather_code[i])}</div>
    `;
    box.appendChild(div);
  }
}

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
    `Sunrise: ${j.daily.sunrise[0].slice(11)} · Sunset: ${j.daily.sunset[0].slice(11)}`;
}

// Weather code → text
function weatherText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    61: "Rain",
    71: "Snow",
    95: "Thunderstorm"
  };
  return map[code] || "Weather";
}

// Weather code → emoji
function icon(code) {
  const map = {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    61: "🌧️",
    71: "❄️",
    95: "⚡"
  };
  return map[code] || "🌡️";
}
