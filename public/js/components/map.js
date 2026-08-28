import * as maplibregl from "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs";

let map = null;
let userMarker = null;
let candidateMarker = null;
let mapReadyPromise = null;

export function initMap(container, styleUrl, center) {
  map = new maplibregl.Map({
    container,
    style: styleUrl,
    center: [center.lon, center.lat],
    zoom: 11,
  });
  mapReadyPromise = new Promise((resolve) => {
    map.on("load", () => resolve());
  });
  return map;
}

export function setUserLocation(lat, lon) {
  if (!map) return;
  if (userMarker) userMarker.remove();
  userMarker = new maplibregl.Marker({ color: "#3fa9f5" }).setLngLat([lon, lat]).addTo(map);
}

export async function showCandidate(userLat, userLon, candLat, candLon) {
  if (!map) return;
  if (mapReadyPromise) await mapReadyPromise;

  if (candidateMarker) candidateMarker.remove();
  candidateMarker = new maplibregl.Marker({ color: "#e8a13b" })
    .setLngLat([candLon, candLat])
    .addTo(map);

  const routeGeoJson = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [userLon, userLat],
        [candLon, candLat],
      ],
    },
  };

  if (map.getSource("route")) {
    map.getSource("route").setData(routeGeoJson);
  } else {
    map.addSource("route", { type: "geojson", data: routeGeoJson });
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#e8a13b",
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    });
  }

  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([userLon, userLat]);
  bounds.extend([candLon, candLat]);
  map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
}

export function recenter(lat, lon) {
  if (!map) return;
  map.flyTo({ center: [lon, lat] });
}
