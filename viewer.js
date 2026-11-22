// Visionneuse 3D (three.js) : charge un .stl et permet de tourner autour.
// Chargée à la demande (import dynamique) uniquement sur les fiches qui ont un modèle.
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function mountViewer(box, url, opts) {
  opts = opts || {};
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return Promise.reject(new Error("webgl"));
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-label", "Modèle 3D interactif");
  box.appendChild(renderer.domElement);

  var visible = true, raf = 0, home = null, disposed = false, mesh = null;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a3, 0.6));
  var key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(1, 1.5, 1.2);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-1, 0.4, -1);
  scene.add(fill);

  // Éclairage de studio (reflets réalistes) : facultatif, la scène reste éclairée s'il ne charge pas.
  import("three/addons/environments/RoomEnvironment.js").then(function (m) {
    if (disposed) return;
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new m.RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }).catch(function () {});

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;
  controls.addEventListener("start", function () { controls.autoRotate = false; });



  function resize() {
    var w = box.clientWidth || 1, h = box.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function loop() {
    raf = 0;
    if (disposed || !visible) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !disposed) raf = requestAnimationFrame(loop); }

  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(box); else window.addEventListener("resize", resize);
  var io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(function (en) {
    visible = en[0].isIntersecting; if (visible) start();
  }) : null;
  if (io) io.observe(box);
  resize();

  return new Promise(function (resolve, reject) {
    new STLLoader().load(url, function (geo) {
      if (disposed) return;
      geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingSphere();
      var mat = new THREE.MeshStandardMaterial({ color: opts.color || 0x1f2430, roughness: 0.55, metalness: 0.1 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2; // les STL sont en Z vers le haut
      scene.add(mesh);
      var r = geo.boundingSphere.radius || 1;
      var dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
      camera.near = dist / 100; camera.far = dist * 20;
      camera.position.set(dist * 0.7, dist * 0.5, dist * 0.8);
      camera.updateProjectionMatrix();
      controls.minDistance = dist * 0.4;
      controls.maxDistance = dist * 3;
      controls.update();
      home = { p: camera.position.clone() };
      resize(); start();
      resolve({
        reset: function () {
          camera.position.copy(home.p); controls.target.set(0, 0, 0);
          controls.autoRotate = true; controls.update();
        },
        setColor: function (hex) { mat.color.setHex(hex); },
        wireframe: function (on) { mat.wireframe = !!on; },
        dispose: dispose
      });
    }, undefined, function () { dispose(); reject(new Error("load")); });
  });

  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
    if (io) io.disconnect();
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}
