import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const input = document.getElementById("file-input");
const fileName = document.getElementById("file-name");
const container = document.getElementById("scene-container");

const analyzeButton = document.getElementById("enterbutton");
const aiStatus = document.getElementById("ai-status");
const aiOverview = document.getElementById("ai-overview");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 0, 100);

// preserveDrawingBuffer allows us to capture the canvas as an image for Groq.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 3));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(10, 20, 15);
scene.add(light);

const loader = new STLLoader();

let mesh = null;
let modelInfo = null;

function resizeRenderer() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resizeRenderer).observe(container);
resizeRenderer();

function getModelInfo(geometry) {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const positions = geometry.getAttribute("position");

  return {
    units: "unknown — STL files do not store unit information",
    dimensions: {
      width: Number(size.x.toFixed(2)),
      height: Number(size.y.toFixed(2)),
      depth: Number(size.z.toFixed(2)),
    },
    vertices: positions.count,
    triangles: geometry.index
      ? geometry.index.count / 3
      : positions.count / 3,
  };
}

function frameModel(geometry) {
  geometry.computeBoundingBox();

  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const diagonal = Math.max(size.length(), 1);
  const distance = diagonal * 1.6;

  // Move the model geometry so it sits in the center of the scene.
  geometry.center();

  camera.near = Math.max(diagonal / 1000, 0.01);
  camera.far = Math.max(diagonal * 100, 1000);
  camera.position.set(distance, distance * 0.7, distance);
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();
}

input.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.textContent = file.name;
  aiStatus.textContent = "Loading STL model...";
  aiOverview.textContent = "";
  analyzeButton.disabled = true;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }

      const geometry = loader.parse(reader.result);
      geometry.computeVertexNormals();

      // Get facts before centering the geometry.
      modelInfo = getModelInfo(geometry);
      frameModel(geometry);

      const material = new THREE.MeshStandardMaterial({
        color: 0x808080,
        metalness: 0.15,
        roughness: 0.55,
      });

      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Keeps compatibility with your existing upload UI.
      const uploadBox = document.getElementsByClassName("upload-box")[0];
      const dropText = document.getElementById("Droptext");

      if (uploadBox) uploadBox.style.display = "none";
      if (dropText) dropText.style.display = "none";

      aiStatus.textContent = "Model ready. Click Analyze model.";
      analyzeButton.disabled = false;
    } catch (error) {
      console.error(error);
      aiStatus.textContent = "Could not load that STL file.";
    }
  };

  reader.readAsArrayBuffer(file);
});

analyzeButton.addEventListener("click", async () => {
  if (!mesh || !modelInfo) return;

  analyzeButton.disabled = true;
  aiStatus.textContent = "Groq is analyzing the model...";
  aiOverview.textContent = "";

  // Screenshot of only the Three.js viewer canvas.
  renderer.render(scene, camera);
  const screenshot = renderer.domElement.toDataURL("image/jpeg", 0.85);

  try {
    const response = await fetch("/api/model-overview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        screenshot,
        modelInfo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI analysis failed.");
    }

    aiOverview.textContent = data.overview;
    aiStatus.textContent = "Analysis complete.";
  } catch (error) {
    console.error(error);
    aiStatus.textContent = `Analysis failed: ${error.message}`;
  } finally {
    analyzeButton.disabled = false;
  }
});

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

animate();