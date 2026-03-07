// ────────────────────────────────────────────────
// Инициализация карты в плоской системе координат (CRS.Simple)
const map = L.map('map', {
  crs: L.CRS.Simple,
  attributionControl: false,
  zoomControl: true,
  minZoom: -3,
  maxZoom: 0
});

// Размеры PNG
const imgWidth = 7015;
const imgHeight = 4960;
const imageBounds = [[0, imgHeight], [imgWidth, 0]];

L.imageOverlay('karta.png', imageBounds, {opacity:1, interactive:false}).addTo(map);
map.fitBounds(imageBounds);

// Смещение и поворот GeoJSON
const offsetX = 1027.5;
const offsetY = 1027.5;
const angle = Math.PI / 2;

// Боковая панель
const infoPanel = document.getElementById('info-panel');
function showProvinceInfo(id) {
    const data = provinceData[id];
    if (!data) return;
    infoPanel.innerHTML = `
        <b>ID:</b> ${id}<br>
        <b>Площадь, км²:</b> ${data.area}<br>
        <b>Название провинции:</b> ${data.name}<br>
        <b>Государство:</b> ${data.state}<br>
        <b>Раса:</b> ${data.race}<br>
        <b>Религия:</b> ${data.religion}<br>
        <b>Население:</b> ${data.population}<br>
        <b>Ресурс:</b> ${data.resource}
    `;
}
function clearPanel() {
    infoPanel.innerHTML = "<b>Выберите провинцию</b>";
}

// ────────────────────────────────────────────────
// Загрузка данных о провинциях из Лист1
let provinceData = {};
let provincesLayer;

fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=0&single=true&output=csv')
.then(res => res.text())
.then(csv => {
    const rows = csv.trim().split('\n').slice(1);
    rows.forEach(rowStr => {
        const row = rowStr.split(',');
        const id = row[0];
        provinceData[id] = {
            area: row[1],
            name: row[2],
            state: row[3],
            race: row[4],
            religion: row[5],
            population: row[6],
            resource: row[7]
        };
    });
    loadGeoJSON();
})
.catch(err => console.error('Ошибка загрузки Лист1:', err));

// ────────────────────────────────────────────────
// Загрузка цветов государств из Лист2
let stateColors = {};
fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=1734047695&single=true&output=csv')
.then(res => res.text())
.then(csv => {
    const rows = csv.trim().split('\n').slice(1);
    rows.forEach(rowStr => {
        const row = rowStr.split(',');
        stateColors[row[0]] = '#' + row[1];
    });
})
.catch(err => console.error('Ошибка загрузки Лист2:', err));

// ────────────────────────────────────────────────
function loadGeoJSON() {
    fetch('provinces.geojson')
    .then(res => res.json())
    .then(data => {
        // Пересчет координат (как у тебя было)
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
                        const newPx = cos*dx - sin*dy + centerPx;
                        const newPy = sin*dx + cos*dy + centerPy;
                        const finalPx = newPx + offsetX;
                        const finalPy = newPy + offsetY;
                        return [finalPy, finalPx];
                    })
                )
            );
            return {...feature, geometry:{...feature.geometry, coordinates:coords}};
        });

        provincesLayer = L.geoJSON({type:'FeatureCollection', features:recalculatedFeatures}, {
            style: feature => {
                const id = feature.properties?.id;
                const state = provinceData[id]?.state;
                const color = stateColors[state] || 'transparent';
                return {
                    fillColor: color,
                    fillOpacity: 0.5,
                    color: '#000',
                    weight: 1
                };
            },
            onEachFeature: function(feature, layer){
                const id = feature.properties?.id;
                layer.on('click', e => {
                    provincesLayer.resetStyle();
                    e.target.setStyle({fillColor:'#ffff99', fillOpacity:0.6, color:'#000', weight:0});
                    e.target.bringToFront();
                    if(id) showProvinceInfo(id);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error('Ошибка загрузки GeoJSON:', err));
}

// ────────────────────────────────────────────────
// Маркеры
var iconTypes = {
    'Столица': L.IconMaterial.icon({icon:'star', iconColor:'white', markerColor:'#B22222', outlineColor:'black', outlineWidth:2, iconSize:[25,34], popupAnchor:[0,-34]}),
    'Город': L.IconMaterial.icon({icon:'home', iconColor:'white', markerColor:'Orange', outlineColor:'black', outlineWidth:2, iconSize:[25,34], popupAnchor:[0,-34]}),
    'Крепость': L.IconMaterial.icon({icon:'castle', iconColor:'white', markerColor:'Gray', outlineColor:'black', outlineWidth:2, iconSize:[25,34], popupAnchor:[0,-34]}),
    'Порт': L.IconMaterial.icon({icon:'anchor', iconColor:'white', markerColor:'SteelBlue', outlineColor:'black', outlineWidth:2, iconSize:[12,16], popupAnchor:[0,-16]})
};

var layers = {
    'Столица': L.layerGroup().addTo(map),
    'Город': L.layerGroup().addTo(map),
    'Крепость': L.layerGroup().addTo(map),
    'Порт': L.layerGroup().addTo(map)
};

var coordinateTrackingLayer = L.layerGroup(); // <- по умолчанию НЕ добавлен

// Перемещаемый маркер столицы
var capitalMarker = L.marker([4500,4500], {icon:iconTypes['Столица'], draggable:true})
.addTo(coordinateTrackingLayer)
.bindPopup(`<b>Столица</b><br>Координаты: 4500, 4500`);

capitalMarker.on('dragend', e=>{
    const pos = e.target.getLatLng();
    e.target.setPopupContent(`<b>Столица</b><br>Координаты: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`).openPopup();
});

// Загрузка маркеров из Google Sheets
const markersSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHKLat89I0Y8aYJgrEbK9CRsDJdaIlvgLEgtzT8WP8m6nGgd9GShkzLQFLShQwjsg9KXOeCtN0p47_/pub?gid=146982985&single=true&output=csv';
fetch(markersSheetURL)
.then(res => res.text())
.then(data=>{
    const rows = data.trim().split('\n').slice(1);
    rows.forEach(rowStr=>{
        const row = rowStr.split(',');
        if(row.length>=5){
            const name=row[0], description=row[1];
            const lat=parseFloat(row[2]), lng=parseFloat(row[3]);
            const type=row[4];
            if(!isNaN(lat)&&!isNaN(lng)&&iconTypes[type]){
                const marker = L.marker([lat,lng],{icon:iconTypes[type]})
                .bindPopup(`<div class="popup-header">${name}</div><div class="popup-description">${description}</div>`);
                if(type!=='Порт'){
                    marker.bindTooltip(name,{permanent:true,direction:'right',offset:L.point(11,-15)});
                }
                layers[type].addLayer(marker);
            }
        }
    });
})
.catch(err=>console.error("Ошибка загрузки маркеров:",err));

// Контрол слоев для маркеров
L.control.layers(null,{
    'Столицы': layers['Столица'],
    'Города': layers['Город'],
    'Крепости': layers['Крепость'],
    'Порты': layers['Порт'],
    'Отслеживание координат': coordinateTrackingLayer
}).addTo(map);
