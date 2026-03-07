// Инициализация карты
const map = L.map('map', {
  crs: L.CRS.Simple,
  attributionControl: false,
  zoomControl: true,
  minZoom: -3,
  maxZoom: 0
});

// Размер изображения
const imgWidth = 7015;
const imgHeight = 4960;

// Границы изображения
const imageBounds = [[0, imgHeight], [imgWidth, 0]];

// Добавление PNG карты
L.imageOverlay('karta.png', imageBounds, {
  opacity: 1.0,
  interactive: false,
  attribution: false
}).addTo(map);

// Показ всей карты
map.fitBounds(imageBounds);

// Смещение GeoJSON
const offsetX = 1027.5;
const offsetY = 1027.5;

// Поворот 90°
const angle = Math.PI / 2;

// Ссылка на Google Sheets CSV
const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?output=csv';

// Хранилище данных таблицы
let provinceData = {};


// ─────────────────────────────────────────────
// Функция чтения CSV
function parseCSV(text) {

  const lines = text.trim().split('\n');
  const data = {};

  for (let i = 1; i < lines.length; i++) {

    const cols = lines[i].split(',');

    const id = cols[0];

    if (!id) continue;

    data[id] = {
      area: cols[1],
      name: cols[2],
      state: cols[3],
      race: cols[4],
      religion: cols[5],
      population: cols[6],
      resource: cols[7]
    };

  }

  return data;
}


// ─────────────────────────────────────────────
// Сначала загружаем таблицу
fetch(sheetURL)
  .then(r => r.text())
  .then(csv => {

    provinceData = parseCSV(csv);

    loadGeoJSON();

  });


// ─────────────────────────────────────────────
// Загрузка GeoJSON
function loadGeoJSON() {

fetch('provinces.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Не удалось загрузить provinces.geojson');
    return response.json();
  })
  .then(data => {

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    data.features.forEach(feature => {

      const coords = feature.geometry.coordinates;
      const flatCoords = coords.flat(3);

      for (let i = 0; i < flatCoords.length; i += 2) {

        const x = flatCoords[i];
        const y = flatCoords[i + 1];

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

      }

    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;


    const recalculatedFeatures = data.features.map(feature => {

      const coords = feature.geometry.coordinates.map(polygon =>
        polygon.map(ring =>
          ring.map(point => {

            const x = point[0];
            const y = point[1];

            // Перевод координат в пиксели
            const px = (x - (-760.292207764065)) / 2.370967741935;
            const py = (y - 1579.390922422695) / (-2.370919458304);

            // Центр изображения
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

      return {
        ...feature,
        geometry: { ...feature.geometry, coordinates: coords }
      };

    });


    const provincesLayer = L.geoJSON(
      { type: 'FeatureCollection', features: recalculatedFeatures },
      {
        style: {
          fillOpacity: 0,
          color: '#000000',
          weight: 1.5,
          opacity: 0
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

            layer.bindPopup(popupContent, {
              autoPan: true,
              closeButton: true
            });

          }


          layer.on('click', function (e) {

            provincesLayer.resetStyle();

            e.target.setStyle({
              fillColor: '#ffff99',
              fillOpacity: 0.6,
              color: '#000',
              weight: 0
            });

            e.target.bringToFront();

            layer.openPopup();

          });


          layer.on('popupclose', function () {

            provincesLayer.resetStyle();

          });

        }

      }
    ).addTo(map);

  })
  .catch(error => {

    console.error('Ошибка:', error);

    alert('Не удалось загрузить provinces.geojson');

  });

}