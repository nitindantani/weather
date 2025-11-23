// Free Weather app (Open-Meteo)
// All-in-browser; no API key needed.

const geoBase = 'https://geocoding-api.open-meteo.com/v1/search';
const weatherBase = 'https://api.open-meteo.com/v1/forecast';

const qInput = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const suggest = document.getElementById('suggest');
const placeEl = document.getElementById('place');
const tempEl = document.getElementById('temp');
const descEl = document.getElementById('desc');
const metaEl = document.getElementById('meta');
const iconEl = document.getElementById('icon');
const hourlyEl = document.getElementById('hourly');
const daysEl = document.getElementById('days');
const updatedEl = document.getElementById('updated');
const timeEl = document.getElementById('time');
const extrasEl = document.getElementById('extras');
const unitToggle = document.getElementById('unitToggle');

let currentUnits = 'metric';
let lastState = JSON.parse(localStorage.getItem('fm_last') || 'null');

const wc = {
  0:{d:'Clear', ico:'☀️'},1:{d:'Mainly clear', ico:'🌤️'},2:{d:'Partly cloudy', ico:'⛅'},3:{d:'Overcast', ico:'☁️'},
  45:{d:'Fog', ico:'🌫️'},61:{d:'Slight rain', ico:'🌧️'},63:{d:'Moderate rain', ico:'🌧️'},65:{d:'Heavy rain', ico:'⛈️'},
  71:{d:'Light snow', ico:'🌨️'},95:{d:'Thunderstorm', ico:'⛈️'}
};

function cToF(c){ return (c*9/5)+32; }
function round(v){ return Math.round(v*10)/10; }

function qs(url){ return fetch(url).then(r=>{ if(!r.ok) throw new Error('Network'); return r.json(); }); }

/* Autocomplete suggestions */
let suggestTimer = 0;
qInput.addEventListener('input', e=>{
  const v = e.target.value.trim();
  if(!v){ suggest.hidden = true; return; }
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(()=> fetchSuggestions(v), 250);
});
qInput.addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ e.preventDefault(); searchByName(qInput.value.trim()); suggest.hidden=true; }
});

async function fetchSuggestions(q){
  try{
    const j = await qs(`${geoBase}?name=${encodeURIComponent(q)}&count=6`);
    if(!j.results || j.results.length===0){ suggest.hidden=true; return; }
    suggest.innerHTML='';
    j.results.forEach(it=>{
      const btn = document.createElement('button');
      btn.innerHTML = `<strong>${it.name}</strong> <span style="color: #9fb0c9"> ${it.country || ''} ${it.admin1 ? ' • '+it.admin1 : ''}</span>`;
      btn.onclick = ()=> { qInput.value = `${it.name}${it.admin1? ', '+it.admin1 : ''}${it.country? ', '+it.country : ''}`; suggest.hidden=true; fetchWeatherByCoords(it.latitude, it.longitude, it); };
      suggest.appendChild(btn);
    });
    suggest.hidden = false;
  } catch(err){ suggest.hidden=true; console.warn(err); }
}

/* Search actions */
searchBtn.addEventListener('click', ()=>{ const v = qInput.value.trim(); if(!v) return alert('Type a city'); searchByName(v); });
locBtn.addEventListener('click', ()=> {
  if(!navigator.geolocation) return alert('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(p=> fetchWeatherByCoords(p.coords.latitude, p.coords.longitude, {name:'Your location'}), err=> alert('Location error: '+err.message), {timeout:10000});
});
async function searchByName(q){
  try{
    const j = await qs(`${geoBase}?name=${encodeURIComponent(q)}&count=1`);
    if(!j.results || j.results.length===0) throw new Error('Not found');
    const it = j.results[0];
    qInput.value = `${it.name}${it.admin1? ', '+it.admin1 : ''}${it.country? ', '+it.country : ''}`;
    fetchWeatherByCoords(it.latitude, it.longitude, it);
  } catch(err){ alert('Search error: '+err.message); }
}

/* Core: fetch weather for coords */
async function fetchWeatherByCoords(lat, lon, location=null){
  try{
    const hourlyParams = ['temperature_2m','relativehumidity_2m','precipitation_probability','windspeed_10m','weathercode'].join(',');
    const dailyParams  = ['temperature_2m_max','temperature_2m_min','weathercode','sunrise','sunset'].join(',');
    const url = `${weatherBase}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=${hourlyParams}&daily=${dailyParams}&timezone=auto`;
    const j = await qs(url);
    const payload = {at: Date.now(), coords:{lat,lon}, location, units: currentUnits, data: j};
    localStorage.setItem('fm_last', JSON.stringify(payload));
    renderAll(payload);
  } catch(err){ alert('Weather error: '+err.message); console.error(err); }
}

/* Rendering */
function renderAll(payload){
  if(!payload || !payload.data) return;
  lastState = payload;
  const d = payload.data;
  const cw = d.current_weather || {};
  const placeName = payload.location && payload.location.name ? `${payload.location.name}${payload.location.admin1? ', '+payload.location.admin1 : ''}${payload.location.country? ', '+payload.location.country : ''}` : (d.timezone || 'Unknown');
  placeEl.textContent = placeName;
  let displayTemp = cw.temperature;
  if(payload.units === 'imperial') displayTemp = round(cToF(displayTemp));
  tempEl.textContent = `${round(displayTemp)}°`;
  const mapping = wc[cw.weathercode] || {d:'Unknown', ico:'🌈'};
  descEl.textContent = mapping.d;
  iconEl.textContent = mapping.ico;
  updatedEl.textContent = `Updated: ${new Date(payload.at).toLocaleString()}`;
  timeEl.textContent = `Local: ${new Date(cw.time).toLocaleString()}`;

  // humidity & wind (from hourly)
  const idx = (d.hourly && d.hourly.time) ? d.hourly.time.indexOf(cw.time) : -1;
  const humidity = (idx>=0 && d.hourly.relativehumidity_2m) ? d.hourly.relativehumidity_2m[idx] : '-';
  const wind = cw.windspeed !== undefined ? cw.windspeed : (idx>=0 && d.hourly.windspeed_10m ? d.hourly.windspeed_10m[idx] : '-');
  metaEl.textContent = `Humidity ${humidity !== '-' ? humidity+'%' : '-'} · Wind ${round(wind)} ${payload.units==='imperial' ? 'mph' : 'm/s'}`;

  // hourly
  hourlyEl.innerHTML = '';
  const times = d.hourly.time || [];
  const temps = d.hourly.temperature_2m || [];
  const codes = d.hourly.weathercode || [];
  const pops = d.hourly.precipitation_probability || [];
  let start = 0; if(idx>=0) start = idx;
  for(let i=start;i<Math.min(times.length, start+24);i++){
    let t = temps[i]; if(payload.units==='imperial') t = round(cToF(t));
    const map = wc[codes[i]] || {ico:'🌈', d:''};
    const p = pops[i] !== undefined ? Math.round(pops[i]) : '';
    const el = document.createElement('div'); el.className='hour-card';
    el.innerHTML = `<div class="small">${new Date(times[i]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    <div style="font-size:20px">${map.ico}</div>
                    <div style="font-weight:700">${round(t)}°</div>
                    <div class="small">${p? p+'% precip':''}</div>`;
    hourlyEl.appendChild(el);
  }

  // daily
  daysEl.innerHTML = '';
  const dTimes = d.daily.time || [];
  const tmax = d.daily.temperature_2m_max || [], tmin = d.daily.temperature_2m_min || [], dCodes = d.daily.weathercode || [];
  for(let i=0;i<Math.min(dTimes.length,7);i++){
    let maxv = tmax[i], minv = tmin[i];
    if(payload.units==='imperial'){ maxv = round(cToF(maxv)); minv = round(cToF(minv)); }
    const map = wc[dCodes[i]] || {ico:'🌈', d:''};
    const el = document.createElement('div'); el.className='day';
    el.innerHTML = `<div class="small">${new Date(dTimes[i]).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})}</div>
                    <div style="font-size:24px">${map.ico}</div>
                    <div style="font-weight:700">${round(maxv)}°</div>
                    <div class="small">H ${round(maxv)} · L ${round(minv)}</div>
                    <div class="small">${map.d}</div>`;
    daysEl.appendChild(el);
  }

  extrasEl.textContent = `Sunrise ${d.daily.sunrise[0] ? new Date(d.daily.sunrise[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '-'} · Sunset ${d.daily.sunset[0] ? new Date(d.daily.sunset[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '-'}`;
}

/* units toggle */
unitToggle.addEventListener('change', ()=>{
  currentUnits = unitToggle.checked ? 'imperial' : 'metric';
  if(lastState){ lastState.units = currentUnits; localStorage.setItem('fm_last', JSON.stringify(lastState)); renderAll(lastState); }
});

/* load cached */
if(lastState){ unitToggle.checked = (lastState.units === 'imperial'); currentUnits = lastState.units || 'metric'; renderAll(lastState); }
