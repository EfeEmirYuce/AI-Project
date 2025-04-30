let graphData;
let selectedNodes = [];

let pathLayer = null;

const map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Helper to calculate distance between two lat/lng points
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Load graph and show markers
fetch('graph-data.json')
  .then(res => res.json())
  .then(data => {
    graphData = data;
    const { coordinates } = graphData;

    for (let node in coordinates) {
      const [lat, lng] = coordinates[node];
      L.marker([lat, lng]).addTo(map).bindPopup(`Node ${node}`);
    }

    // Add map click listener
    map.on('click', function (e) {
      const nearest = findNearestNode(e.latlng.lat, e.latlng.lng);
      if (!nearest) return;

      selectedNodes.push(nearest);
      L.popup()
        .setLatLng(graphData.coordinates[nearest])
        .setContent(selectedNodes.length === 1
          ? `Start: ${nearest}`
          : `End: ${nearest}`)
        .openOn(map);

        if (selectedNodes.length === 2) {
            const result = dijkstra(graphData, selectedNodes[0], selectedNodes[1]);
            console.log("Shortest path:", result.path, "Distance:", result.distance);
          
            const latlngs = result.path.map(n => graphData.coordinates[n]);
          
            // Remove existing path if any
            if (pathLayer) {
              map.removeLayer(pathLayer);
            }
          
            pathLayer = L.polyline(latlngs, { color: 'blue' }).addTo(map)
              .bindPopup(`Distance: ${result.distance}`).openPopup();
          }
          
    });
  });

// Find the nearest node to a clicked point
function findNearestNode(lat, lng) {
  let nearest = null;
  let minDistance = Infinity;

  for (let node in graphData.coordinates) {
    const [nLat, nLng] = graphData.coordinates[node];
    const dist = getDistance(lat, lng, nLat, nLng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = node;
    }
  }

  return nearest;
}

document.getElementById('resetBtn').addEventListener('click', () => {
    selectedNodes = [];
    if (pathLayer) {
      map.removeLayer(pathLayer);
      pathLayer = null;
    }
    map.closePopup();
  });
  