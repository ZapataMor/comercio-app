(() => {
    const status = document.getElementById('negocios-map-status');
    const container = document.getElementById('mapa-negocios');
    if (!window.L) {
        status.textContent = 'No se pudo cargar el mapa. Los negocios siguen disponibles en las tarjetas.';
        return;
    }
    const negocios = JSON.parse(document.getElementById('negocios-map-data').textContent);
    const map = L.map(container, {scrollWheelZoom: false}).setView([11.378, -72.24], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).on('tileerror', () => {
        status.textContent = 'No se pudo cargar parte del mapa. Revisa tu conexión; las tarjetas siguen disponibles.';
    }).addTo(map);
    const markers = new Map();
    const points = [];
    for (const negocio of negocios) {
        const point = [negocio.lat, negocio.lng];
        points.push(point);
        const popup = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = negocio.nombre;
        const detail = document.createElement('p');
        detail.textContent = (negocio.activo ? 'Abierto' : 'Cerrado') + ' · ' + (negocio.direccion || 'Sin dirección registrada');
        const link = document.createElement('a');
        link.href = negocio.url;
        link.textContent = 'Ver negocio →';
        popup.append(title, detail, link);
        const marker = L.marker(point, {
            title: negocio.nombre,
            icon: L.divIcon({className: 'negocio-pin', html: '<span class="' + (negocio.activo ? 'abierto' : 'cerrado') + '"></span>', iconSize: [24,24], iconAnchor: [12,12]})
        }).addTo(map).bindPopup(popup);
        markers.set(String(negocio.id), marker);
    }
    if (points.length) map.fitBounds(points, {padding: [32,32], maxZoom: 16});
    document.querySelectorAll('[data-negocio-id]').forEach(button => {
        const marker = markers.get(button.dataset.negocioId);
        if (!marker) return;
        button.hidden = false;
        button.addEventListener('click', () => {
            container.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center'});
            map.setView(marker.getLatLng(), 17);
            marker.openPopup();
        });
    });
})();
