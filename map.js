// Инициализация карты в плоской системе координат (CRS.Simple)
const map = L.map('map', {
  crs: L.CRS.Simple,
  attributionControl: false,
  zoomControl: true,
  minZoom: -3,
  maxZoom: 0
});

// ТОЧНЫЕ размеры, при которых PNG отображается ВЕРНО
const imgWidth = 7015;
const imgHeight = 4960;

// Границы в пикселях для CRS.Simple (Y = 0 сверху, Y = imgHeight снизу)
const imageBounds = [[0, imgHeight], [imgWidth, 0]];

// PNG как базовый слой
L.imageOverlay('karta.png', imageBounds, {
  opacity: 1.0,
  interactive: false,
  attribution: false
}).addTo(map);

// Начальный вид — вся карта
map.fitBounds(imageBounds);

// ────────────────────────────────────────────────
// Смещение GeoJSON-слоя (подбирай эти значения!)
const offsetX = 1027.5;
const offsetY = 1027.5;

// Угол поворота — 90° по часовой стрелке
const angle = Math.PI / 2;

// Загрузка GeoJSON провинций
fetch('provinces.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Не удалось загрузить provinces.geojson');
    return response.json();
  })
  .then(data => {
    // Находим bounding box всех координат GeoJSON (для центра поворота)
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

    // Пересчитываем координаты GeoJSON в пиксели PNG + поворачиваем на 90°
    const recalculatedFeatures = data.features.map(feature => {
      const coords = feature.geometry.coordinates.map(polygon =>
        polygon.map(ring =>
          ring.map(point => {
            const x = point[0];
            const y = point[1];
            // 1. Перевод в пиксели по .pgw
            const px = (x - (-760.292207764065)) / 2.370967741935;
            const py = (y - 1579.390922422695) / (-2.370919458304);
            // 2. Поворот на 90° по часовой стрелке
            const centerPx = imgWidth / 2;
            const centerPy = imgHeight / 2;
            const dx = px - centerPx;
            const dy = py - centerPy;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const newPx = cos * dx - sin * dy + centerPx;
            const newPy = sin * dx + cos * dy + centerPy;
            // 3. Добавляем смещение
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
            layer.bindPopup(
              `ID: ${id}`,
              { autoPan: true, closeButton: true }
            );
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