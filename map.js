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

// URLs Google Sheets
const sheet1URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?output=csv';
const sheet2URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=123456789&single=true&output=csv';

let provinceData = {};
let countryColors = {};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (!cols[0]) continue;
    data[cols[0]] = cols.slice(1);
  }
  return data;
}

// Загружаем оба листа
Promise.all([
  fetch(sheet1URL).then(r => r.text()),
  fetch(sheet2URL).then(r => r.text())
]).then(([csv1, csv2]) => {
  // Лист1 — данные по провинциям
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
    countryColors[countryName] = '#' + color; // добавляем #
  }

  loadGeoJSON();
});

// ─────────────────────────────────────────────
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

      const provincesLayer = L.geoJSON(
        { type: 'FeatureCollection', features: recalculatedFeatures },
        {
          style: feature => {
            const id = feature.properties?.id;
            if (id && provinceData[id]) {
              const state = provinceData[id].state;
              const color = countryColors[state];
              if (color) {
                // Все провинции одного государства окрашиваются одинаково
                return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
              }
            }
            return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
          },
          onEachFeature: function (feature, layer) {
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

            layer.on('click', function (e) {
              provincesLayer.resetStyle();
              e.target.setStyle({ fillColor: '#ffff99', fillOpacity: 0.6, color: '#000', weight: 0 });
              e.target.bringToFront();
              layer.openPopup();
            });

            layer.on('popupclose', function () { provincesLayer.resetStyle(); });
          }
        }
      ).addTo(map);
    })
    .catch(error => {
      console.error('Ошибка:', error);
      alert('Не удалось загрузить provinces.geojson');
    });
}