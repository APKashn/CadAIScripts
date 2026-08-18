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
scene.background = new THREE.Color(0x121212);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 0, 100);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- EVEN STUDIO LIGHTING SETUP (NO DARK SPOTS) ---
// Ambient light raises overall scene luminance
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

// Key directional light (front-right)
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(100, 100, 100);
scene.add(keyLight);

// Fill directional light (back-left-bottom)
const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-100, -50, -100);
scene.add(fillLight);

// Top-down hemisphere sky/ground light
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemiLight);

const loader = new STLLoader();

let mesh = null;
let modelInfo = null;

function resizeRenderer() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (width === 0 || height === 0) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resizeRenderer);
resizeRenderer();

function getModelInfo(geometry) {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const positions = geometry.getAttribute("position");

  return {
    units: "mm (estimated)",
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

  geometry.center();

  camera.position.set(distance, distance * 0.7, distance);
  camera.lookAt(0, 0, 0);

  controls.target.set(0, 0, 0);
  controls.update();
}

if (input) {
  input.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (fileName) fileName.textContent = file.name;
    if (aiStatus) aiStatus.textContent = "Loading STL model...";
    if (aiOverview) aiOverview.innerText = "";
    if (analyzeButton) analyzeButton.disabled = true;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        if (mesh) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }

        const geometry = loader.parse(reader.result);
        
        // --- FIX Z-UP CAD ORIENTATION TO THREE.JS Y-UP ---
        geometry.rotateX(-Math.PI / 2);
        
        geometry.computeVertexNormals();

        modelInfo = getModelInfo(geometry);
        frameModel(geometry);

        const material = new THREE.MeshStandardMaterial({
          color: 0x909090,
          metalness: 0.1,
          roughness: 0.4,
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const uploadBox = document.getElementsByClassName("upload-box")[0];
        const dropText = document.getElementById("Droptext");

        if (uploadBox) uploadBox.style.display = "none";
        if (dropText) dropText.style.display = "none";

        resizeRenderer();

        if (aiStatus) aiStatus.textContent = "Model ready. Click Analyze model.";
        if (analyzeButton) analyzeButton.disabled = false;
      } catch (error) {
        console.error(error);
        if (aiStatus) aiStatus.textContent = "Could not load that STL file.";
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

if (analyzeButton) {
  analyzeButton.addEventListener("click", async () => {
    if (!mesh || !modelInfo) return;

    analyzeButton.disabled = true;
    if (aiStatus) aiStatus.textContent = "Analyzing your model...";
    if (aiOverview) aiOverview.innerText = "";

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

      if (aiOverview) aiOverview.innerText = data.overview;
      if (aiStatus) aiStatus.textContent = "Analysis complete.";
    } catch (error) {
      console.error(error);
      if (aiStatus) aiStatus.textContent = `Analysis failed: ${error.message}`;
    } finally {
      analyzeButton.disabled = false;
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();