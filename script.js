let map;
let graphData;
let startNode = null;
let endNode = null;
let pathLine = null;

map = L.map('map').setView([51.5074, -0.1278], 6); //Londra

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routingControl = L.Routing.control({
  waypoints: [],
  lineOptions: {
    styles: [{color: 'blue', opacity: 0.7, weight: 6}]
  },
  router: new L.Routing.OSRMv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1'
  }),
  createMarker: function() { return null; }
}).addTo(map);

const distanceCache = {};

async function getRouteDistance(fromLat, fromLng, toLat, toLng, transportMode) {
  const cacheKey = `${fromLat},${fromLng}-${toLat},${toLng}-${transportMode}`;
  if (distanceCache[cacheKey]) {
    return distanceCache[cacheKey];
  }
  
  try {
    let osrmMode = transportMode;
    if (transportMode === 'car') osrmMode = 'driving';
    if (transportMode === 'pedestrian') osrmMode = 'foot';
    if (transportMode === 'bicycle') osrmMode = 'bike';
    
    const response = await fetch(`https://router.project-osrm.org/route/v1/${osrmMode}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const distance = data.routes[0].distance;
      const duration = data.routes[0].duration; 
      
      distanceCache[cacheKey] = {
        distance: distance,
        duration: duration
      };
      
      return distanceCache[cacheKey];
    } else {
      console.error('Rota bulunamadı:', data);
      const airDistance = calculateDistance(fromLat, fromLng, toLat, toLng);
      
      let speed = 13.9; 
      if (transportMode === 'pedestrian') speed = 1.4; 
      if (transportMode === 'bicycle') speed = 4.2; 
      
      return { 
        distance: airDistance, 
        duration: airDistance / speed 
      };
    }
  } catch (error) {
    console.error('Rota sorgusu hatası:', error);
    const airDistance = calculateDistance(fromLat, fromLng, toLat, toLng);
    
    let speed = 13.9;
    if (transportMode === 'pedestrian') speed = 1.4;
    if (transportMode === 'bicycle') speed = 4.2; 
    
    return { 
      distance: airDistance, 
      duration: airDistance / speed 
    };
  }
}

function makeGraphUndirected(graph) {
  const undirectedEdges = {};
  
  graph.nodes.forEach(node => {
    undirectedEdges[node] = [];
  });
  
  graph.edges = undirectedEdges;
  return graph;
}

fetch('graph-data.json')
  .then(response => response.json())
  .then(data => {
    graphData = makeGraphUndirected(data);
    addMarkers();
    drawGraphEdges();
  })
  .catch(error => console.error('Graph data loading error:', error));

function addMarkers() {
  const coords = graphData.coordinates;
  for (const node in coords) {
    const [lat, lng] = coords[node];
    const marker = L.marker([lat, lng]).addTo(map)
      .bindPopup(`Node: ${node}`);

    marker.on('click', function () {
      selectNode(node);
    });
  }
}

function selectNode(node) {
  if (!startNode) {
    startNode = node;
    document.getElementById('start-node').textContent = startNode;
    alert(`Start node selected: ${startNode}`);
  } else if (!endNode) {
    endNode = node;
    document.getElementById('end-node').textContent = endNode;
    alert(`End node selected: ${endNode}`);
    calculateAndDrawPath();
  } else {
    alert('Start and End already selected. Please reset.');
  }
}

async function calculateRealRouteDistance(startNode, endNode) {
  if (!startNode || !endNode) return null;
  
  const startCoord = graphData.coordinates[startNode];
  const endCoord = graphData.coordinates[endNode];
  
  if (!startCoord || !endCoord) return null;
  
  const modeSelect = document.getElementById('mode-select');
  transportMode = modeSelect;
  
  const routeInfo = await getRouteDistance(
    startCoord[0], startCoord[1], 
    endCoord[0], endCoord[1], 
    transportMode
  );
  
  let edgeExists = graphData.edges[startNode].some(edge => edge.node === endNode);
  
  if (!edgeExists) {
    graphData.edges[startNode].push({
      node: endNode,
      weight: routeInfo.distance
    });
    
    edgeExists = graphData.edges[endNode].some(edge => edge.node === startNode);
    if (!edgeExists) {
      graphData.edges[endNode].push({
        node: startNode,
        weight: routeInfo.distance
      });
    }
  }
  
  return routeInfo;
}

async function calculateAndDrawPath() {
  if (!startNode || !endNode) {
    alert('Lütfen başlangıç ve bitiş noktası seçin.');
    return;
  }
  
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-indicator';
  loadingDiv.style.position = 'fixed';
  loadingDiv.style.top = '50%';
  loadingDiv.style.left = '50%';
  loadingDiv.style.transform = 'translate(-50%, -50%)';
  loadingDiv.style.backgroundColor = 'white';
  loadingDiv.style.padding = '20px';
  loadingDiv.style.borderRadius = '5px';
  loadingDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
  loadingDiv.style.zIndex = '1000';
  loadingDiv.innerHTML = '<h3>Rota hesaplanıyor...</h3>';
  document.body.appendChild(loadingDiv);
  
  try {
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
      transportMode = modeSelect.value;
      switch (transportMode) {
        case 'pedestrian':
          profile = 'foot';
          break;
        case 'bicycle':
          profile = 'bike';
          break;
        default:
          profile = 'car';
      }
    }
    
    const routeInfo = await calculateRealRouteDistance(startNode, endNode);
    
    const result = dijkstra(graphData, startNode, endNode);
    
    if (!result.path.length) {
      alert('Yol bulunamadı.');
      document.body.removeChild(loadingDiv);
      return;
    }
    
    const waypoints = result.path.map(node => {
      const [lat, lng] = graphData.coordinates[node];
      return L.latLng(lat, lng);
    });
    
    if (routingControl) {
      map.removeControl(routingControl);
    }
    
    routingControl = L.Routing.control({
      waypoints: waypoints,
      lineOptions: {
        styles: [{color: 'red', opacity: 0.8, weight: 4}]
      },
      router: new L.Routing.OSRMv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: profile
      }),
      createMarker: function() { return null; }
    }).addTo(map);
    
    const pathText = result.path.join(' → ');
    document.getElementById('path-nodes').innerHTML = `<strong>Path:</strong> ${pathText}`;
    
    if (routeInfo) {
      document.getElementById('distance').textContent = `${(routeInfo.distance/1000).toFixed(2)} km`;
    }
  } finally {
    document.body.removeChild(loadingDiv);
  }
}

function resetSelection() {
  startNode = null;
  endNode = null;
  document.getElementById('start-node').textContent = "None";
  document.getElementById('end-node').textContent = "None";
  document.getElementById('distance').textContent = "0";
  
  if (document.getElementById('time')) {
    document.getElementById('time').textContent = "0";
  }
  
  document.getElementById('path-nodes').innerHTML = "<strong>Path:</strong>";

  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
}

function dijkstra(graph, startNode, endNode) {
  const distances = {};
  const previous = {};
  const unvisited = new Set();

  Object.keys(graph.coordinates).forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
    unvisited.add(node);
  });
  distances[startNode] = 0;

  while (unvisited.size > 0) {
    let currentNode = null;
    let minDistance = Infinity;
    
    for (const node of unvisited) {
      if (distances[node] < minDistance) {
        currentNode = node;
        minDistance = distances[node];
      }
    }

    if (currentNode === endNode || minDistance === Infinity) {
      break;
    }

    unvisited.delete(currentNode);

    if (graph.edges[currentNode]) {
      for (const edge of graph.edges[currentNode]) {
        const neighbor = edge.node;
        const weight = edge.weight || 1;
        
        const distanceThroughCurrent = distances[currentNode] + weight;
        
        if (distanceThroughCurrent < distances[neighbor]) {
          distances[neighbor] = distanceThroughCurrent;
          previous[neighbor] = currentNode;
        }
      }
    }
  }

  const path = [];
  let current = endNode;
  
  if (previous[endNode] === null && startNode !== endNode) {
    return { path: [], distance: 0 };
  }
  
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path: path,
    distance: distances[endNode]
  };
}

map.on('contextmenu', function(e) {
  const latlng = e.latlng;
  
  const nodeName = prompt("Yeni node adı girin:");
  
  if (nodeName && nodeName.trim() !== "") {
    addNewNode(nodeName.trim(), [latlng.lat, latlng.lng]);
  }
});

function addNewNode(nodeName, coordinates) {
  if (graphData.coordinates[nodeName]) {
    alert(`"${nodeName}" adında bir node zaten mevcut.`);
    return;
  }
  
  if (!graphData.nodes.includes(nodeName)) {
    graphData.nodes.push(nodeName);
  }
  
  graphData.coordinates[nodeName] = coordinates;
  
  if (!graphData.edges[nodeName]) {
    graphData.edges[nodeName] = [];
  }
  
  const [lat, lng] = coordinates;
  const marker = L.marker([lat, lng]).addTo(map)
    .bindPopup(`Node: ${nodeName}`);
  
  marker.on('click', function() {
    selectNode(nodeName);
  });
  
  alert(`"${nodeName}" node'u başarıyla eklendi.`);
}

function addEdge(fromNode, toNode) {
  if (!graphData.coordinates[fromNode] || !graphData.coordinates[toNode]) {
    alert("Bir veya her iki node bulunamadı.");
    return;
  }
  
  const fromCoord = graphData.coordinates[fromNode];
  const toCoord = graphData.coordinates[toNode];
  
  const weight = calculateDistance(fromCoord[0], fromCoord[1], toCoord[0], toCoord[1]);
  
  const edgeExists = graphData.edges[fromNode].some(edge => edge.node === toNode);
  
  if (!edgeExists) {
    graphData.edges[fromNode].push({ node: toNode, weight });
    
    const reverseEdgeExists = graphData.edges[toNode].some(edge => edge.node === fromNode);
    
    if (!reverseEdgeExists) {
      if (!graphData.edges[toNode]) {
        graphData.edges[toNode] = [];
      }
      graphData.edges[toNode].push({ node: fromNode, weight });
    }
    
    drawGraphEdges();
    
    alert(`${fromNode} ve ${toNode} arasında bağlantı eklendi. Mesafe: ${(weight/1000).toFixed(2)} km`);
    return true;
  } else {
    alert("Bu kenar zaten mevcut.");
    return false;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; 
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon1 - lon2) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c;
  return Math.round(distance); 
}

function saveGraphData() {
  const jsonData = JSON.stringify(graphData, null, 2);
  
  localStorage.setItem('graphData', jsonData);
  console.log('Veri localStorage\'a kaydedildi');
}

function deleteNode(nodeName) {
  if (!graphData.coordinates[nodeName]) {
    alert(`"${nodeName}" adında bir node bulunamadı.`);
    return;
  }
  
  const nodeIndex = graphData.nodes.indexOf(nodeName);
  if (nodeIndex > -1) {
    graphData.nodes.splice(nodeIndex, 1);
  }
  
  delete graphData.coordinates[nodeName];
  
  delete graphData.edges[nodeName];
  
  for (const node in graphData.edges) {
    graphData.edges[node] = graphData.edges[node].filter(edge => edge.node !== nodeName);
  }
  
  map.eachLayer(function(layer) {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
  
  addMarkers();
  drawGraphEdges();
  
  alert(`"${nodeName}" node'u başarıyla silindi.`);
}

const nodeManagementUI = `
<div id="node-management">
  <div>
    <button id="delete-node-btn">Delete Node</button>
  </div>
  <p>Right click for adding a new node</p>
</div>
`;

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('info').insertAdjacentHTML('beforeend', nodeManagementUI);
  
  document.getElementById('delete-node-btn').addEventListener('click', function() {
    const nodeName = prompt("Silinecek node adı:");
    if (nodeName) {
      deleteNode(nodeName);
    }
  });
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', function() {
      if (startNode && endNode) {
        calculateAndDrawPath();
      }
    });
  }
});