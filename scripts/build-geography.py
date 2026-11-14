"""Build the redistributable ODbL map asset from the extracted OSM relations."""
import heapq
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import LineString, box
from shapely.ops import polygonize, unary_union

source, inventory, output = map(Path, sys.argv[1:4])
data = json.loads(source.read_text())
network = json.loads(inventory.read_text())
nodes = {int(key): value for key, value in data["nodes"].items()}
ways = {int(key): value for key, value in data["ways"].items()}
relations = {int(key): value for key, value in data["rels"].items()}
route_relations = {
    "M1A": [305496], "M1B": [4289712], "M2": [11341406, 7719796],
    "M3": [4289797], "M4": [2396287], "M5": [11344904], "M6": [7719781],
    "M7": [15085833, 11799409], "M8": [14900216], "M9": [4289800], "M11": [15083964],
    "B1": [9987139], "T1": [2962729], "T2": [301617], "T3": [2409338],
    "T4": [11344897], "T5": [12174616], "F1": [300961], "F2": [301616],
    "F3": [9476599], "F4": [14738977], "U3": [19587363],
}
coordinates = {
    # The operator lists these T4 stops. OSM maps both on the track but
    # omits them from the outbound route relation's stop members.
    4958585469: (28.8724297, 41.0837323),
    4958557322: (28.8608215, 41.1057675),
    251899092: (28.9597143, 41.0096120),
}

def point(node):
    return tuple(nodes[node][:2]) if node in nodes else coordinates.get(node)

def distance(a, b):
    return math.hypot((a[0] - b[0]) * .754, a[1] - b[1])

def route_graph(members):
    graph = defaultdict(dict)
    for kind, ref, role in members:
        if kind != "w" or role not in {"", "forward", "backward"}:
            continue
        for a, b in zip(ways[ref], ways[ref][1:]):
            if point(a) is not None and point(b) is not None:
                cost = distance(point(a), point(b))
                graph[a][b] = graph[b][a] = cost
    return graph

def path_to(graph, start, end):
    queue, previous, best = [(0, start)], {}, {start: 0}
    while queue:
        dist, node = heapq.heappop(queue)
        if node == end:
            path = [node]
            while node != start:
                node = previous[node]
                path.append(node)
            return list(reversed(path))
        if dist > best[node]:
            continue
        for neighbor, cost in graph[node].items():
            candidate = dist + cost
            if candidate < best.get(neighbor, math.inf):
                best[neighbor] = candidate
                previous[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    return None

def route_stops(key, members):
    matched = [ref for kind, ref, role in members if kind == "n" and (role.startswith("stop") or role == "terminal")]
    if key == "M7":
        del matched[3]  # Both route relations list Mecidiyeköy.
    if key == "T4":
        matched.insert(15, 4958585469)
        matched.insert(19, 4958557322)
    if key == "T1":
        # Sort by operator sequence where the relation lists stops out of order.
        indexes = [*range(10, 21), 28, 21, *range(22, 26), 27, 26, 29]
        matched = [*matched[:10], 251899092, *(matched[index] for index in indexes)]
    return matched

asset = {"attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0", "licenseUrl": "https://www.openstreetmap.org/copyright", "routes": {}, "coast": [], "land": []}
for route in network["lines"]:
    key = route["id"]
    members = sum((relations[ref] for ref in route_relations[key]), [])
    graph = route_graph(members)
    matched = route_stops(key, members)
    ids = route["stops"] + (route.get("branch") or [])
    assert len(ids) == len(matched), (key, len(ids), len(matched))
    for ref in matched:
        assert point(ref) is not None, (key, ref, "missing stop coordinates")
    exact = [ref if ref in graph else min(graph, key=lambda n: distance(point(n), point(ref))) for ref in matched]
    groups = [(route["stops"], exact[:len(route["stops"])])]
    if route.get("branch"):
        groups.append((route["branch"], exact[len(route["stops"]):]))
    edges, places = [], {}
    for ids, refs in groups:
        if route.get("loop"):
            ids, refs = ids + ids[:1], refs + refs[:1]
        for id, ref in zip(ids, refs):
            places.setdefault(id, point(ref))
        for a, b, ra, rb in zip(ids, ids[1:], refs, refs[1:]):
            path = path_to(graph, ra, rb)
            if path is None:
                raise ValueError((key, a, b, ra, rb, distance(point(ra), point(rb))))
            shape = LineString([point(ref) for ref in path]).simplify(.000032)
            edges.append([a, b, [[round(x,6),round(y,6)] for x,y in shape.coords]])
    asset["routes"][key] = {"relations": route_relations[key], "stops": places, "edges": edges}
    print(key, len(places), len(edges))

# Assemble OSM's directed shorelines into land polygons inside the map bounds.
# Land is on the left of each coastline way.
extent = box(28.20, 40.48, 29.88, 41.65)
coast = []
for way in data["coast"].values():
    if len(way) < 2 or any(point(ref) is None for ref in way):
        continue
    line = LineString([point(ref) for ref in way])
    if line.intersects(extent):
        simplified = line.simplify(.00015)
        coast.append(simplified)
merged = unary_union([extent.boundary, *(line.intersection(extent) for line in coast)])
left_probes = [line.parallel_offset(.000025, "left") for line in coast]
for polygon in polygonize(merged):
    if polygon.area < .0000005:
        continue
    land = sum(probe.intersection(polygon).length for probe in left_probes)
    shore = sum(line.intersection(polygon.boundary.buffer(.000004)).length for line in coast)
    if land > shore * .48 and land > 0:
        asset["land"].append([[list(point) for point in polygon.exterior.coords],
                              *[[list(point) for point in ring.coords] for ring in polygon.interiors]])
for line in coast:
    parts = line.intersection(extent)
    for part in ([parts] if parts.geom_type == "LineString" else getattr(parts, "geoms", [])):
        if part.geom_type == "LineString":
            asset["coast"].append([list(point) for point in part.coords])
assert asset["land"], "No land polygons found"
output.write_text(json.dumps(asset, ensure_ascii=False, separators=(",", ":")) + "\n")
