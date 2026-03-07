// ───────────────────────────────
// Инициализация карты
const map = L.map('map', {
  crs: L.CRS.Simple,
  attributionControl: false,
  zoomControl: true,
  minZoom: -3,
  maxZoom: 0
});

// Полноэкранный контроль
map.addControl(new L.Control.Fullscreen({
  position: 'topleft',
  title: 'Полноэкранный режим',
  titleCancel: 'Выйти из полноэкранного режима'
}));

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
let idLayerGroup = L.layerGroup(); // Слой для ID (по умолчанию скрыт)

// ───────────────────────────────
// Загрузка CSV
Promise.all([fetch(sheet1URL).then(r => r.text()), fetch(sheet2URL).then(r => r.text())])
  .then(([csv1, csv2]) => {
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
    .then(r => r.ok ? r.json() : Promise.reject('Не удалось загрузить provinces.geojson'))
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
      createIdToggleButton();
    })
    .catch(err => { console.error(err); alert(err); });
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
// Легенда с интерактивной подсветкой
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
// Генерация ID провинций (только при включении слоя)
function generateIdLabels() {
  idLayerGroup.clearLayers();
  provincesLayer.eachLayer(layer => {
    const id = layer.feature.properties?.id;
    if (id) {
      const bounds = layer.getBounds();
      const center = bounds.getCenter();

      const icon = L.divIcon({
        className: 'province-id-label',
        html: `<div style="font-size:18px; font-weight:bold; color:red; text-shadow:1px 1px 2px white;">${id}</div>`,
        iconSize: [30, 30]
      });

      L.marker(center, { icon: icon }).addTo(idLayerGroup);
    }
  });
}

// ───────────────────────────────
// Кнопка включения/выключения слоя с ID
function createIdToggleButton() {
  const toggleIdControl = L.control({ position: 'topleft' });
  toggleIdControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', '', div);
    button.innerHTML = 'ID';
    button.href = '#';
    button.title = 'Показать/Скрыть ID провинций';
    button.style.textAlign = 'center';
    button.style.fontWeight = 'bold';
    button.style.fontSize = '14px';
    button.style.width = '30px';
    button.style.height = '30px';
    button.style.lineHeight = '30px';
    button.style.backgroundColor = 'white';
    button.style.border = '1px solid #ccc';
    button.style.cursor = 'pointer';

    let visible = false;

    button.onclick = function(e) {
      e.preventDefault();
      visible = !visible;
      if (visible) {
        generateIdLabels();
        idLayerGroup.addTo(map);
        button.style.backgroundColor = '#ffd';
      } else {
        idLayerGroup.remove();
        button.style.backgroundColor = 'white';
      }
    };

    return div;
  };
  toggleIdControl.addTo(map);
}
