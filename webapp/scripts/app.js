// Thomson's Falls CesiumJS skeleton app
// ------------------------------------
// This script creates a basic CesiumJS Viewer instance,
// using Cesium World Terrain and World Imagery as placeholders.
// Later, we will replace:
//   - terrainProvider with tiles built from dem_thomsonsfalls.tif
//   - imageryProvider with Sentinel-2 / WorldCover-derived layers.

// Create the Cesium viewer in the #cesiumContainer div
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: Cesium.createWorldTerrain(),   // placeholder terrain
  imageryProvider: Cesium.createWorldImagery(),   // placeholder imagery
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  sceneModePicker: true
});

// Approximate area-of-interest around Thomson's Falls,
// matching the rectangle used in the Earth Engine script.
const aoiRectangle = Cesium.Rectangle.fromDegrees(
  36.35,  // west longitude
  -0.07,  // south latitude
  36.45,  // east longitude
  0.01    // north latitude
);

// Set initial camera view to the AOI
viewer.camera.setView({
  destination: aoiRectangle
});

// Optionally expose the viewer in the browser console for debugging
window.viewer = viewer;