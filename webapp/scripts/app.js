// -------------------------
// Cesium ion initialization
// -------------------------

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2ViY2FjNi1iYjM5LTQ5ZmQtODM3Mi03NWExNmY1ZTdjMGEiLCJpZCI6NDUyMjY4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODMxMDkyNTV9.BakumX90X00ws8_lPAKPLA2Bb7CExV1BTpBgFJjhqqM";

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

// Allow camera to get very close to terrain and respect collisions
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 5; // meters
viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

// -------------------------
// Imagery: Thomson's Falls Sentinel GeoTIFF from ion
// -------------------------

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

// Keyboard shortcuts for viewpoints
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a") flyTo(viewpoints.aerial);
  if (key === "r") flyTo(viewpoints.rim);
  if (key === "g") flyTo(viewpoints.gorgeBase);
  if (key === "u") flyTo(viewpoints.upstream);
  if (key === "d") flyTo(viewpoints.downstream);
});

// -------------------------
// Simple cliff-height measurement tool
// -------------------------

const measureButton = document.getElementById("measureCliffButton");
const measureResult = document.getElementById("measureResult");

let measuring = false;
let firstPointCartographic = null;

// Use a ScreenSpaceEventHandler to capture clicks
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

async function sampleTerrainHeight(cartographic) {
  const [updated] = await Cesium.sampleTerrainMostDetailed(
    viewer.terrainProvider,
    [cartographic]
  );
  return updated.height;
}

// Start measurement when button is clicked
measureButton.addEventListener("click", () => {
  measuring = true;
  firstPointCartographic = null;
  measureResult.textContent =
    "Click cliff top, then cliff base on the terrain.";
});

// Handle left clicks on the globe
handler.setInputAction(async (movement) => {
  if (!measuring) {
    return;
  }
  const cartesian = viewer.scene.pickPosition(movement.position);
  if (!cartesian) {
    measureResult.textContent = "Click on terrain (not sky).";
    return;
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

  if (!firstPointCartographic) {
    // First click: cliff top
    firstPointCartographic = cartographic;
    const topHeight = await sampleTerrainHeight(firstPointCartographic);
    measureResult.textContent =
      "Cliff top sampled at ~" + topHeight.toFixed(1) + " m. Now click base.";
  } else {
    // Second click: cliff base
    const baseHeight = await sampleTerrainHeight(cartographic);
    const topHeight = await sampleTerrainHeight(firstPointCartographic);
    const diff = topHeight - baseHeight;

    measureResult.textContent =
      "Cliff height ≈ " + diff.toFixed(1) + " m (top " +
      topHeight.toFixed(1) +
      " m, base " +
      baseHeight.toFixed(1) +
      " m).";

    // Finish measurement
    measuring = false;
    firstPointCartographic = null;
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Expose viewer for debugging in browser console
window.viewer = viewer;