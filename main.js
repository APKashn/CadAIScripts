import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const input = document.getElementById("file-input");
const fileName = document.getElementById("file-name");
const container = document.getElementById("scene-container");

const width = container.clientWidth;
const height = container.clientHeight;

input.addEventListener("change", () => {
  if (input.files.length) {
    fileName.textContent = input.files[0].name;
  }

});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  50,
  width / height,
  0.1,
  1000
);
camera.position.set(0, 0, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 3));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(10, 20, 15);
scene.add(light);

const loader = new STLLoader();
let mesh;

input.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    const geometry = loader.parse(reader.result);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.15,
      roughness: 0.55
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    document.getElementsByClassName("upload-box")[0].style.display ="none";
    document.getElementById("Droptext").style.display ="none";
    //document.getElementsByClassName("scene-container")[0].style.height ="700px";

    geometry.computeBoundingBox();

    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const size = geometry.boundingBox.getSize(new THREE.Vector3()).length();

    mesh.position.sub(center);

    camera.position.set(size, size * 0.7, size);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  reader.readAsArrayBuffer(file);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});