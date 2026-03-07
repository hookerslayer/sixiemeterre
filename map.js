// ───────────────────────────────
// Инициализация карты
const map = L.map('map', {
  crs: L.CRS.Simple,
  attributionControl: false,
  zoomControl: true,
  minZoom: -3,
  maxZoom: 0
});

const imgWidth = 7015;
const imgHeight = 4960;
const imageBounds = [[0, imgHeight], [imgWidth, 0]];

L.imageOverlay('karta.png', imageBounds, {
  opacity: 1.0,
  interactive: false,
  attribution: false
}).addTo(map);

map.fitBounds(imageBounds);

const offsetX = 1027.5;
const offsetY = 1027.5;
const angle = Math.PI / 2;

// ───────────────────────────────
// Google Sheets CSV ссылки
const sheet1URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=0&single=true&output=csv';
const sheet2URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=1734047695&single=true&output=csv';

let provinceData = {};
let countryColors = {};
let provincesLayer;

// ───────────────────────────────
// Загрузка CSV
Promise.all([fetch(sheet1URL).then(r => r.text()), fetch(sheet2URL).then(r => r.text())])
  .then(([csv1, csv2]) => {
    // Лист1 — провинции
    const lines1 = csv1.trim().split('\n');
    for (let i = 1; i < lines1.length; i++) {
      const cols = lines1[i].split(',');
      const id = cols[0];
      if (!id) continue;
      provinceData[id] = {
        area: cols[1],
        name: cols[2],
        state: cols[3],
        race: cols[4],
        religion: cols[5],
        population: cols[6],
        resource: cols[7]
      };
    }

    // Лист2 — цвета государств
    const lines2 = csv2.trim().split('\n');
    for (let i = 1; i < lines2.length; i++) {
      const cols = lines2[i].split(',');
      const countryName = cols[0];
      const color = cols[1];
      if (!countryName || !color) continue;
      countryColors[countryName] = '#' + color;
    }

    loadGeoJSON();
  });

// ───────────────────────────────
// Загрузка GeoJSON и подготовка карты
function loadGeoJSON() {
  fetch('provinces.geojson')
    .then(r => {
      if (!r.ok) throw new Error('Не удалось загрузить provinces.geojson');
      return r.json();
    })
    .then(data => {
      const recalculatedFeatures = data.features.map(feature => {
        const coords = feature.geometry.coordinates.map(polygon =>
          polygon.map(ring =>
            ring.map(point => {
              const x = point[0];
              const y = point[1];

              const px = (x - (-760.292207764065)) / 2.370967741935;
              const py = (y - 1579.390922422695) / (-2.370919458304);

              const centerPx = imgWidth / 2;
              const centerPy = imgHeight / 2;
              const dx = px - centerPx;
              const dy = py - centerPy;

              const cos = Math.cos(angle);
              const sin = Math.sin(angle);

              const newPx = cos * dx - sin * dy + centerPx;
              const newPy = sin * dx + cos * dy + centerPy;

              const finalPx = newPx + offsetX;
              const finalPy = newPy + offsetY;

              return [finalPy, finalPx];
            })
          )
        );
        return { ...feature, geometry: { ...feature.geometry, coordinates: coords } };
      });

      provincesLayer = L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: feature => {
          const id = feature.properties?.id;
          if (id && provinceData[id]) {
            const state = provinceData[id].state;
            const color = countryColors[state];
            if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
          }
          return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
        },
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(map);

      createLegend();
      createSearch();
    })
    .catch(err => { console.error(err); alert('Не удалось загрузить provinces.geojson'); });
}

// ───────────────────────────────
// Обработка каждого полигона
function onEachProvince(feature, layer) {
  const id = feature.properties?.id;
  if (id != null) {
    const info = provinceData[id];
    let popupContent = `ID: ${id}`;
    if (info) {
      popupContent = `
ID: ${id}<br>
Площадь, км2: ${info.area}<br>
Название провинции: ${info.name}<br>
Государство: ${info.state}<br>
Раса: ${info.race}<br>
Религия: ${info.religion}<br>
Население: ${info.population}<br>
Ресурс: ${info.resource}
`;
    }
    layer.bindPopup(popupContent, { autoPan: true, closeButton: true });
  }

  layer.on('click', function(e) {
    provincesLayer.resetStyle();
    e.target.setStyle({ fillColor: '#ffff99', fillOpacity: 0.6, color: '#000', weight: 0 });
    e.target.bringToFront();
    layer.openPopup();
  });

  layer.on('popupclose', function() { provincesLayer.resetStyle(); });
}

// ───────────────────────────────
// Подсветка по государству (легенда)
function highlightState(stateName) {
  provincesLayer.eachLayer(layer => {
    const id = layer.feature.properties?.id;
    if (id && provinceData[id] && provinceData[id].state === stateName) {
      layer.setStyle({ fillOpacity: 0.8 });
      layer.bringToFront();
    }
  });
}

function resetHighlight() {
  provincesLayer.eachLayer(layer => {
    const id = layer.feature.properties?.id;
    if (id && provinceData[id]) {
      const state = provinceData[id].state;
      const color = countryColors[state];
      if (color) layer.setStyle({ fillOpacity: 0.5 });
      else layer.setStyle({ fillOpacity: 0 });
    }
  });
}

// ───────────────────────────────
// Создание интерактивной легенды
function createLegend() {
  const legend = L.control({ position: 'topright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'white';
    div.style.padding = '10px';
    div.style.border = '1px solid #ccc';
    div.style.maxHeight = '400px';
    div.style.overflowY = 'auto';
    div.innerHTML = '<b>Государства</b><br>';

    for (const [state, color] of Object.entries(countryColors)) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.marginBottom = '4px';
      item.style.cursor = 'pointer';

      const colorBox = document.createElement('div');
      colorBox.style.width = '20px';
      colorBox.style.height = '20px';
      colorBox.style.backgroundColor = color;
      colorBox.style.marginRight = '6px';
      colorBox.style.border = '1px solid #000';

      const label = document.createElement('span');
      label.textContent = state;

      item.appendChild(colorBox);
      item.appendChild(label);
      div.appendChild(item);

      item.addEventListener('mouseenter', () => highlightState(state));
      item.addEventListener('mouseleave', () => resetHighlight());
    }
    return div;
  };
  legend.addTo(map);
}

// ───────────────────────────────
// Создание поиска по ID
function createSearch() {
  const searchDiv = L.control({ position: 'topleft' });
  searchDiv.onAdd = function() {
    const div = L.DomUtil.create('div', 'info search');
    div.style.background = 'white';
    div.style.padding = '6px';
    div.style.border = '1px solid #ccc';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Введите ID провинции';
    input.style.width = '140px';
    input.style.marginRight = '4px';

    const button = document.createElement('button');
    button.textContent = 'Найти';

    button.onclick = () => {
      const id = input.value.trim();
      if (!id || !provinceData[id]) { alert('Провинция не найдена'); return; }
      provincesLayer.eachLayer(layer => {
        if (layer.feature.properties?.id === id) {
          provincesLayer.resetStyle();
          layer.setStyle({ fillColor: '#ffff99', fillOpacity: 0.6, color: '#000', weight: 0 });
          layer.bringToFront();
          layer.openPopup();
          map.fitBounds(layer.getBounds(), { padding: [100, 100] });
        }
      });
    };

    div.appendChild(input);
    div.appendChild(button);
    return div;
  };
  searchDiv.addTo(map);
}
