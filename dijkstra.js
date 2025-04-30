function dijkstra(graph, start, end) {
    const distances = {};
    const prev = {};
    const visited = new Set();
    const pq = new Map();
  
    for (let node of graph.nodes) {
      distances[node] = Infinity;
      prev[node] = null;
      pq.set(node, Infinity);
    }
  
    distances[start] = 0;
    pq.set(start, 0);
  
    while (pq.size > 0) {
      const current = [...pq.entries()].reduce((a, b) => a[1] < b[1] ? a : b)[0];
      pq.delete(current);
      visited.add(current);
  
      if (current === end) break;
  
      for (let neighbor of graph.edges[current]) {
        if (visited.has(neighbor.node)) continue;
        const alt = distances[current] + neighbor.weight;
        if (alt < distances[neighbor.node]) {
          distances[neighbor.node] = alt;
          prev[neighbor.node] = current;
          pq.set(neighbor.node, alt);
        }
      }
    }
  
    // Build path
    const path = [];
    let u = end;
    while (u) {
      path.unshift(u);
      u = prev[u];
    }
  
    return {
      path,
      distance: distances[end]
    };
  }
  