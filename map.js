function searchProvinceById() {
  const searchControl = L.control({ position: 'topright' });
  searchControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-search');
    div.innerHTML = `
      <input
        type="text"
        id="province-search"
        placeholder="Поиск по ID..."
        style="
          width: 150px;
          padding: 5px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 12px;
        "
      />
      <button
        id="search-button"
        style="
          margin-left: 5px;
          padding: 5px 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
        "
      >
        Найти
      </button>
    `;

    div.querySelector('#search-button').addEventListener('click', () => {
      const searchId = div.querySelector('#province-search').value.trim();
      if (!searchId) return;

      let foundLayer = null;
      // Ищем во всех слоях
      [politicalLayer, religionLayer, raceLayer, resourceLayer, tradeZoneLayer].forEach(layer => {
        layer.eachLayer(l => {
          const id = l.feature?.properties?.id;
          if (id && id.toString() === searchId) {
            foundLayer = l;
          }
        });
      });

      if (foundLayer) {
        map.fitBounds(foundLayer.getBounds());
        foundLayer.openPopup();
        // Подсветка (опционально)
        foundLayer.setStyle({ fillColor: '#ffff99', fillOpacity: 0.6, color: '#000', weight: 0 });
        foundLayer.bringToFront();
      } else {
        alert(`Провинция с ID ${searchId} не найдена!`);
        console.log("Доступные ID в provinceData:", Object.keys(provinceData));
        console.log("Доступные ID в politicalLayer:", []);
        politicalLayer.eachLayer(l => {
          console.log(l.feature?.properties?.id);
        });
      }
    });

    div.querySelector('#province-search').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        div.querySelector('#search-button').click();
      }
    });

    return div;
  };
  searchControl.addTo(map);
}
