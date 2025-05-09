function dijkstra(graph, startNode, endNode) {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const queue = [];

  graph.nodes.forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[startNode] = 0;
  queue.push({ node: startNode, distance: 0 });

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const { node: currentNode } = queue.shift();

    if (visited.has(currentNode)) continue;
    visited.add(currentNode);

    if (currentNode === endNode) break;

    const neighbors = graph.edges[currentNode] || [];
    neighbors.forEach(neighbor => {
      const alt = distances[currentNode] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = currentNode;
        queue.push({ node: neighbor.node, distance: alt });
      }
    });
  }

  const path = [];
  let current = endNode;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path,
    distance: distances[endNode]
  };
}
