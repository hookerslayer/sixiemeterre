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

map.legend = null;

// ───────────────────────────────
// Google Sheets CSV ссылки
const sheet1URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=0&single=true&output=csv';
const sheet2URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=1734047695&single=true&output=csv';
const markersSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=146982985&single=true&output=csv';

let provinceData = {};
let countryColors = {};
let religionColors = {};  // Цвета религий
let raceColors = {};      // Цвета рас
let resourceColors = {};  // Цвета ресурсов
let tradeZoneColors = {}; // Цвета торговых зон
let selectedProvince = null;
let searchHighlight = null;

// Слои для каждого типа карты
const politicalLayer = L.layerGroup().addTo(map);  // Политическая (по умолчанию)
const religionLayer = L.layerGroup();              // Религиозная
const raceLayer = L.layerGroup();                  // Расовая
const resourceLayer = L.layerGroup();             // Ресурсная
const tradeZoneLayer = L.layerGroup();             // Торговые зоны

// ───────────────────────────────
// Иконки для маркеров
const iconTypes = {
  'Столица': L.IconMaterial.icon({ icon: 'star', iconColor: 'white', markerColor: '#B22222', outlineColor: 'black', outlineWidth: 2, iconSize: [25, 34], popupAnchor: [0, -34] }),
  'Город': L.IconMaterial.icon({ icon: 'home', iconColor: 'white', markerColor: 'Orange', outlineColor: 'black', outlineWidth: 2, iconSize: [25, 34], popupAnchor: [0, -34] }),
  'Крепость': L.IconMaterial.icon({ icon: 'castle', iconColor: 'white', markerColor: 'Gray', outlineColor: 'black', outlineWidth: 2, iconSize: [25, 34], popupAnchor: [0, -34] }),
  'Порт': L.IconMaterial.icon({ icon: 'anchor', iconColor: 'white', markerColor: 'SteelBlue', outlineColor: 'black', outlineWidth: 2, iconSize: [12, 16], popupAnchor: [0, -16] })
};

// Группы слоев для маркеров
const markerLayers = {
  'Столица': L.layerGroup().addTo(map),
  'Город': L.layerGroup().addTo(map),
  'Крепость': L.layerGroup().addTo(map),
  'Порт': L.layerGroup().addTo(map)
};

// Слой для перемещаемого маркера координат
const coordinateTrackingLayer = L.layerGroup();
const capitalMarker = L.marker([4500, 4500], { icon: iconTypes['Столица'], draggable: true }).addTo(coordinateTrackingLayer);
capitalMarker.bindPopup(`<b>Столица</b><br>Координаты: ${capitalMarker.getLatLng().lat}, ${capitalMarker.getLatLng().lng}`);
capitalMarker.on('dragend', e => {
  const pos = e.target.getLatLng();
  e.target.setPopupContent(`<b>Столица</b><br>Координаты: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`).openPopup();
  console.log(`Новые координаты: ${pos.lat}, ${pos.lng}`);
});

// ───────────────────────────────
// Загрузка CSV с данными провинций и цветов
Promise.all([fetch(sheet1URL).then(r => r.text()), fetch(sheet2URL).then(r => r.text())])
  .then(([csv1, csv2]) => {
    // Загрузка данных провинций (sheet1URL)
    csv1.trim().split('\n').slice(1).forEach(rowStr => {
      const cols = rowStr.split(',');
      const id = cols[0];
      if (!id) return;
      provinceData[id] = {
        area: cols[1],
        name: cols[2],
        state: cols[3],
        race: cols[4],
        religion: cols[5],
        population: cols[6],
        resource: cols[7],
        tradeZone: cols[8]
      };
    });

    // Загрузка цветов (sheet2URL)
    csv2.trim().split('\n').slice(1).forEach(rowStr => {
      const cols = rowStr.split(',');
      if (cols[0] && cols[1]) countryColors[cols[0]] = '#' + cols[1];
      if (cols[6] && cols[7]) religionColors[cols[6]] = '#' + cols[7];
      if (cols[3] && cols[4]) raceColors[cols[3]] = '#' + cols[4];
      if (cols[9] && cols[10]) resourceColors[cols[9]] = '#' + cols[10];
      if (cols[12] && cols[13]) tradeZoneColors[cols[12]] = '#' + cols[13];
    });

    // Загрузка GeoJSON и создание слоёв
    loadGeoJSON();
    loadMarkers();
  });

// Стиль для политической карты
function politicalStyle(f) {
  const id = f.properties?.id;
  if (id && provinceData[id] && provinceData[id].state) {
    const color = countryColors[provinceData[id].state];
    if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
  }
  return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
}

// Стиль для религиозной карты
function religionStyle(f) {
  const id = f.properties?.id;
  if (id && provinceData[id] && provinceData[id].religion) {
    const color = religionColors[provinceData[id].religion];
    if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
  }
  return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
}

// Стиль для расовой карты
function raceStyle(f) {
  const id = f.properties?.id;
  if (id && provinceData[id] && provinceData[id].race) {
    const color = raceColors[provinceData[id].race];
    if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
  }
  return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
}

// Стиль для ресурсной карты
function resourceStyle(f) {
  const id = f.properties?.id;
  if (id && provinceData[id] && provinceData[id].resource) {
    const color = resourceColors[provinceData[id].resource];
    if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
  }
  return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
}

// Стиль для торговых зон
function tradeZoneStyle(f) {
  const id = f.properties?.id;
  if (id && provinceData[id] && provinceData[id].tradeZone) {
    const color = tradeZoneColors[provinceData[id].tradeZone];
    if (color) return { fillColor: color, fillOpacity: 0.5, color: '#000', weight: 0 };
  }
  return { fillOpacity: 0, color: '#000', weight: 1.5, opacity: 0 };
}

// ───────────────────────────────
// Загрузка GeoJSON
function loadGeoJSON() {
  fetch('provinces.geojson')
    .then(r => r.ok ? r.json() : Promise.reject('Не удалось загрузить provinces.geojson'))
    .then(data => {
      const recalculatedFeatures = data.features.map(f => ({
        ...f,
        geometry: { ...f.geometry,
          coordinates: f.geometry.coordinates.map(polygon =>
            polygon.map(ring =>
              ring.map(p => {
                const x = p[0], y = p[1];
                const px = (x - (-760.292207764065)) / 2.370967741935;
                const py = (y - 1579.390922422695) / (-2.370919458304);
                const dx = px - imgWidth / 2, dy = py - imgHeight / 2;
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const newPx = cos * dx - sin * dy + imgWidth / 2;
                const newPy = sin * dx + cos * dy + imgHeight / 2;
                return [newPy + offsetY, newPx + offsetX];
              })
            )
          )
        }
      }));

      // Политическая карта
      L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: politicalStyle,
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(politicalLayer);

      // Религиозная карта
      L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: religionStyle,
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(religionLayer);

      // Расовая карта
      L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: raceStyle,
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(raceLayer);

      // Ресурсная карта
      L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: resourceStyle,
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(resourceLayer);

      // Торговые зоны
      L.geoJSON({ type: 'FeatureCollection', features: recalculatedFeatures }, {
        style: tradeZoneStyle,
        onEachFeature: onEachProvince,
        smoothFactor: 0,
        noClip: true
      }).addTo(tradeZoneLayer);

      // Создание легенд и контроллера слоёв
      createLegend('state', countryColors); // Политическая (по умолчанию)
      createLayerControl();
      createIdToggleButton();
    })
    .catch(err => { console.error(err); alert(err); });
}

// Получение активного слоя
function getActiveLayer() {
  if (map.hasLayer(politicalLayer)) return politicalLayer;
  if (map.hasLayer(religionLayer)) return religionLayer;
  if (map.hasLayer(raceLayer)) return raceLayer;
  if (map.hasLayer(resourceLayer)) return resourceLayer;
  if (map.hasLayer(tradeZoneLayer)) return tradeZoneLayer;
  return politicalLayer;
}

// Сохраняем GeoJSON слои глобально
let geojsonLayers = [politicalLayer, religionLayer, raceLayer, resourceLayer, tradeZoneLayer];

// ───────────────────────────────
// Массив для хранения подсвеченных при поиске провинций
let searchHighlights = [];

// Получение текущего активного слоя
function getActiveLayer() {
  if (map.hasLayer(politicalLayer)) return politicalLayer;
  if (map.hasLayer(religionLayer)) return religionLayer;
  if (map.hasLayer(raceLayer)) return raceLayer;
  if (map.hasLayer(resourceLayer)) return resourceLayer;
  if (map.hasLayer(tradeZoneLayer)) return tradeZoneLayer;
  return politicalLayer;
}

// Функция получения стиля для провинции по текущему активному слою
function getCurrentStyle(province) {
  const layer = getActiveLayer();
  if (!province || !province.feature) return {};
  if (layer === politicalLayer) return politicalStyle(province.feature);
  if (layer === religionLayer) return religionStyle(province.feature);
  if (layer === raceLayer) return raceStyle(province.feature);
  if (layer === resourceLayer) return resourceStyle(province.feature);
  if (layer === tradeZoneLayer) return tradeZoneStyle(province.feature);
  return {};
}

// ───────────────────────────────
// Подсветка провинций при поиске по ID (включая группы)
function highlightProvinceById(id) {
  const inputId = id.toString().trim();

  // Сброс предыдущей подсветки поиска
  searchHighlights.forEach(prov => {
    prov.setStyle(getCurrentStyle(prov));
  });
  searchHighlights = [];

  let found = false;

  geojsonLayers.forEach(layerGroup => {
    layerGroup.eachLayer(layer => {
      if (!layer.eachLayer) return;

      layer.eachLayer(province => {
        const provinceId = (province.feature?.properties?.id || '').toString();
        const groupId = (province.feature?.properties?.groupId || provinceId).toString();

        if (provinceId === inputId || groupId === inputId) {
          // Подсветка красной обводкой
          province.setStyle({
            color: '#ff0000',
            weight: 3,
            opacity: 1,
            fillOpacity: (province.options.fillOpacity || 0.3) * 0.7
          });
          province.bringToFront();

          searchHighlights.push(province);
          found = true;
        }
      });
    });
  });

  if (!found) {
    alert("Провинция с таким ID не найдена");
  } else {
    // Центрируем карту на первую найденную провинцию
    map.fitBounds(searchHighlights[0].getBounds(), { maxZoom: -1 });
  }
}

// ───────────────────────────────
// Обработчик кнопки поиска
function searchProvince() {
  const input = document.getElementById("provinceSearch");
  if (!input) return;
  const id = input.value.trim();
  if (!id) return;
  highlightProvinceById(id);
}

// ───────────────────────────────
// Обработчик клика и pop-up для каждой провинции
function onEachProvince(feature, layer) {
  const id = feature.properties?.id;
  if (!id) return;

  const info = provinceData[id];
  let content = `ID: ${id}`;
  if (info) {
    content = `ID: ${id}<br>Название провинции: ${info.name}<br>Раса: ${info.race}<br>Религия: ${info.religion}<br>Ресурс: ${info.resource}`;
  }
  layer.bindPopup(content, { autoPan: true, closeButton: true });

  layer.on('click', () => {
    const activeLayer = getActiveLayer();

    // Сбрасываем подсветку поиска
    searchHighlights.forEach(prov => prov.setStyle(getCurrentStyle(prov)));
    searchHighlights = [];

    // Подсветка всех провинций с этим ID или groupId
    activeLayer.eachLayer(l => {
      if (!l.eachLayer) return;

      l.eachLayer(prov => {
        const provinceId = (prov.feature?.properties?.id || '').toString();
        const groupId = (prov.feature?.properties?.groupId || provinceId).toString();

        if (provinceId === id || groupId === id) {
          prov.setStyle({
            fillColor: '#ffff99',
            fillOpacity: 0.6,
            color: '#000',
            weight: 0
          });
          prov.bringToFront();
        } else {
          // Сбрасываем стиль в соответствии с активным слоем
          prov.setStyle(getCurrentStyle(prov));
        }
      });
    });

    layer.openPopup();
  });

  layer.on('popupclose', () => {
    // При закрытии popup сбросить все провинции к стилю активного слоя
    const activeLayer = getActiveLayer();
    if (activeLayer && activeLayer.eachLayer) {
      activeLayer.eachLayer(l => {
        if (!l.eachLayer) return;
        l.eachLayer(prov => prov.setStyle(getCurrentStyle(prov)));
      });
    }
  });
}

// ───────────────────────────────
// Легенда
function createLegend(type, colors) {
  // Удалить старую легенду, если она есть
  if (map.legend) map.removeControl(map.legend);

  const legend = L.control({ position: 'topright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'white';
    div.style.padding = '10px';
    div.style.border = '1px solid #ccc';
    div.style.maxHeight = '400px';
    div.style.overflowY = 'auto';
    div.innerHTML = `<b>${type === 'state' ? 'Государства' :
                     type === 'religion' ? 'Религии' :
                     type === 'race' ? 'Расы' :
                     type === 'resource' ? 'Ресурсы' : 'Торговые зоны'}</b><br>`;

    for (const [name, color] of Object.entries(colors)) {
      if (!name || !color) continue;
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
      label.textContent = name;

      item.appendChild(colorBox);
      item.appendChild(label);
      div.appendChild(item);
    }
    return div;
  };
  legend.addTo(map);
  map.legend = legend; // Сохраняем ссылку для удаления
}

// Контроллер слоёв
function createLayerControl() {
  L.control.layers({
    'Политическая карта': politicalLayer,
    'Религиозная карта': religionLayer,
    'Расовая карта': raceLayer,
    'Ресурсная карта': resourceLayer,
    'Торговые зоны': tradeZoneLayer
  }, null, { position: 'topleft' }).addTo(map);

  // События при переключении слоёв
  map.on('baselayerchange', e => {
    const layerName = e.name;
    if (layerName === 'Политическая карта') createLegend('state', countryColors);
    if (layerName === 'Религиозная карта') createLegend('religion', religionColors);
    if (layerName === 'Расовая карта') createLegend('race', raceColors);
    if (layerName === 'Ресурсная карта') createLegend('resource', resourceColors);
    if (layerName === 'Торговые зоны') createLegend('tradeZone', tradeZoneColors);
  });
}

// ───────────────────────────────
// Слой ID провинций
let idLayerGroup = L.layerGroup(); // Слой для ID (по умолчанию скрыт)
function generateIdLabels() {

  idLayerGroup.clearLayers();

  const currentLayer = getActiveLayer();

  currentLayer.eachLayer(geoLayer => {

    if (!geoLayer.eachLayer) return;

    geoLayer.eachLayer(province => {

      const id = province.feature?.properties?.id;
      if (!id) return;

      const center = province.getBounds().getCenter();

      const icon = L.divIcon({
        className: 'province-id-label',
        html: `<div style="
          font-size:18px;
          font-weight:bold;
          color:red;
          text-shadow:1px 1px 2px white;
        ">${id}</div>`,
        iconSize: [30, 30]
      });

      L.marker(center, { icon }).addTo(idLayerGroup);

    });

  });

}
function createIdToggleButton() {
  const toggle = L.control({ position: 'topleft' });
  toggle.onAdd = () => {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', '', div);
    button.innerHTML = 'ID'; button.href = '#'; button.title = 'Показать/Скрыть ID провинций';
    button.style.textAlign = 'center'; button.style.fontWeight = 'bold'; button.style.fontSize = '14px';
    button.style.width = '30px'; button.style.height = '30px'; button.style.lineHeight = '30px';
    button.style.backgroundColor = 'white'; button.style.border = '1px solid #ccc'; button.style.cursor = 'pointer';

    let visible = false;
    button.onclick = e => {
      e.preventDefault(); visible = !visible;
      if (visible) { generateIdLabels(); idLayerGroup.addTo(map); button.style.backgroundColor = '#ffd'; }
      else { idLayerGroup.remove(); button.style.backgroundColor = 'white'; }
    };
    return div;
  };
  toggle.addTo(map);
}

// ───────────────────────────────
// Загрузка маркеров из Google Sheets
function loadMarkers() {
  fetch(markersSheetURL)
    .then(r => r.text())
    .then(csv => {
      const lines = csv.trim().split('\n').slice(1);
      lines.forEach(rowStr => {
        const row = rowStr.split(',');
        if (row.length >= 5) {
          const name = row[0], desc = row[1], lat = parseFloat(row[2]), lng = parseFloat(row[3]), type = row[4];
          if (!isNaN(lat) && !isNaN(lng) && iconTypes[type]) {
            const marker = L.marker([lat, lng], { icon: iconTypes[type] })
              .bindPopup(`<div class="popup-header">${name}</div><div class="popup-description">${desc}</div>`);
            if (type !== 'Порт') marker.bindTooltip(name, { permanent: true, direction: 'right', offset: L.point(11, -15) });
            markerLayers[type].addLayer(marker);
          }
        }
      });
    })
    .catch(err => console.error("Ошибка загрузки маркеров:", err));

  // Контрол слоёв для маркеров
  L.control.layers(null, {
    'Столицы': markerLayers['Столица'],
    'Города': markerLayers['Город'],
    'Крепости': markerLayers['Крепость'],
    'Порты': markerLayers['Порт'],
    'Отслеживание координат': coordinateTrackingLayer
  }).addTo(map);
}
