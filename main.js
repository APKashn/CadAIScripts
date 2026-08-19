import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

let scene, camera, renderer, controls, currentMesh;
let modelInfo = null;

const sceneContainer = document.getElementById("scene-container");
const fileInput = document.getElementById("file-input");
const enterButton = document.getElementById("enterbutton");
const inputField = document.querySelector(".inputfield");
const aiStatus = document.getElementById("ai-status");
const aiOverview = document.getElementById("ai-overview");

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x001000);

    camera = new THREE.PerspectiveCamera(
        45,
        sceneContainer.clientWidth / sceneContainer.clientHeight,
        0.1,
        1000
    );
    camera.position.set(100, 100, 100);

    // preserveDrawingBuffer: true allows capturing canvas screenshots with .toDataURL()
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    sceneContainer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 1, 1).normalize();
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x555555, 0.5);
    dirLight2.position.set(-1, -1, -1).normalize();
    scene.add(dirLight2);

    window.addEventListener("resize", onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
}

// STL File Loader
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function (event) {
        const contents = event.target.result;
        const loader = new STLLoader();
        const geometry = loader.parse(contents);

        if (currentMesh) scene.remove(currentMesh);

        // Center geometry on its local origin
        geometry.computeBoundingBox();
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            color: 0x90caf9,
            roughness: 0.4,
            metalness: 0.2
        });

        currentMesh = new THREE.Mesh(geometry, material);

        // FIX: Rotate -90 degrees around X-axis to convert CAD Z-up to Three.js Y-up
        currentMesh.rotation.x = -Math.PI / 2;

        scene.add(currentMesh);

        // Calculate size metrics from raw geometry bounds
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Position camera relative to upright model
        camera.position.set(maxDim * 1.8, maxDim * 1.8, maxDim * 1.8);
        camera.lookAt(0, 0, 0);

        modelInfo = {
            dimensions: {
                width: size.x.toFixed(2),
                height: size.y.toFixed(2),
                depth: size.z.toFixed(2)
            },
            triangles: geometry.attributes.position.count / 3,
            vertices: geometry.attributes.position.count
        };

        enterButton.disabled = false;
        aiStatus.textContent = "Model loaded successfully. Ready to analyze.";
        aiOverview.textContent = "";
    };
});

// Capture Canvas & Call Server API
enterButton.addEventListener("click", async () => {
    if (!currentMesh || !modelInfo) return;

    enterButton.disabled = true;
    aiStatus.textContent = "Analyzing model visual geometry & properties...";
    aiOverview.textContent = "";

    renderer.render(scene, camera);
    const screenshotDataUrl = renderer.domElement.toDataURL("image/png");
    const userPromptText = inputField.value.trim();

    try {
        const response = await fetch("/api/model-overview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                screenshot: screenshotDataUrl,
                modelInfo: modelInfo,
                userPrompt: userPromptText
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to evaluate model.");
        }

        aiStatus.textContent = "Analysis Complete:";
        aiOverview.innerHTML = marked.parse(data.overview);

    } catch (err) {
        console.error(err);
        aiStatus.textContent = "Error during analysis:";
        aiOverview.textContent = err.message;
    } finally {
        enterButton.disabled = false;
    }
});

initScene();