// -------------------------
// Cesium ion initialization
// -------------------------

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2ViY2FjNi1iYjM5LTQ5ZmQtODM3Mi03NWExNmY1ZTdjMGEiLCJpZCI6NDUyMjY4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODMxMDkyNTV9.BakumX90X00ws8_lPAKPLA2Bb7CExV1BTpBgFJjhqqM";

// Terrain: Thomson's Falls DEM from Cesium ion
const terrainProvider = new Cesium.CesiumTerrainProvider({
  url: Cesium.IonResource.fromAssetId(5018338)
});

// -------------------------
// Viewer setup
// -------------------------

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: terrainProvider,
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  sceneModePicker: true
});

// -------------------------
// Imagery: Thomson's Falls Sentinel GeoTIFF from ion
// -------------------------
//
// Upload your GeoTIFF (e.g., sentinel_thomsonsfalls.tif) to Cesium ion
// as Raster Imagery, then use its asset ID here. [web:212][web:216][web:218][web:219][web:215]

// Remove default base layer (Bing or other)
const baseLayer = viewer.imageryLayers.get(0);
if (baseLayer) {
  viewer.imageryLayers.remove(baseLayer);
}

// Add your own site-specific Sentinel imagery from ion
viewer.imageryLayers.addImageryProvider(
  new Cesium.IonImageryProvider({ assetId: 5018470 })
);

// -------------------------
// Viewpoint system
// -------------------------

// Approximate viewpoints around Thomson's Falls.
// Refine lon/lat/height and orientation later as needed. [web:184][web:201]

const viewpoints = {
  aerial: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.03, 2800),
    heading: Cesium.Math.toRadians(220),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0.0
  },
  rim: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.03, 2400),
    heading: Cesium.Math.toRadians(200),
    pitch: Cesium.Math.toRadians(-20),
    roll: 0.0
  },
  gorgeBase: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.031, 2250),
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-10),
    roll: 0.0
  },
  upstream: {
    destination: Cesium.Cartesian3.fromDegrees(36.375, -0.025, 2400),
    heading: Cesium.Math.toRadians(200),
    pitch: Cesium.Math.toRadians(-15),
    roll: 0.0
  },
  downstream: {
    destination: Cesium.Cartesian3.fromDegrees(36.385, -0.035, 2350),
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-15),
    roll: 0.0
  }
};

// Helper to fly to a given viewpoint
function flyTo(view) {
  viewer.camera.flyTo({
    destination: view.destination,
    orientation: {
      heading: view.heading,
      pitch: view.pitch,
      roll: view.roll
    },
    duration: 2.5
  });
}

// Initial view: aerial overview
flyTo(viewpoints.aerial);

// Keyboard shortcuts for viewpoints:
// A = aerial overview
// R = rim
// G = gorge base
// U = upstream
// D = downstream
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a") flyTo(viewpoints.aerial);
  if (key === "r") flyTo(viewpoints.rim);
  if (key === "g") flyTo(viewpoints.gorgeBase);
  if (key === "u") flyTo(viewpoints.upstream);
  if (key === "d") flyTo(viewpoints.downstream);
});

// Expose viewer for debugging in browser console
window.viewer = viewer;