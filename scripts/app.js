// Thomson's Falls CesiumJS skeleton app
// ------------------------------------
// This script creates a basic CesiumJS Viewer instance,
// using Cesium World Terrain and World Imagery as placeholders.
// Later, we will replace:
//   - terrainProvider with tiles built from dem_thomsonsfalls.tif
//   - imageryProvider with Sentinel-2 / WorldCover-derived layers.

// Set your Cesium ion access token
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2ViY2FjNi1iYjM5LTQ5ZmQtODM3Mi03NWExNmY1ZTdjMGEiLCJpZCI6NDUyMjY4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODMxMDkyNTV9.BakumX90X00ws8_lPAKPLA2Bb7CExV1BTpBgFJjhqqM";

// Create a terrain provider from your ion terrain asset
const terrainProvider = Cesium.CesiumTerrainProvider.fromIonAssetId(5018338);

// Create the Cesium viewer using your own terrain
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: terrainProvider,
  imageryProvider: Cesium.createWorldImagery(),   // placeholder imagery for now
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  sceneModePicker: true
});

// Approximate AOI around Thomson's Falls
const aoiRectangle = Cesium.Rectangle.fromDegrees(
  36.35,  // west lon
  -0.07,  // south lat
  36.45,  // east lon
  0.01    // north lat
);

viewer.camera.setView({
  destination: aoiRectangle
});

window.viewer = viewer;