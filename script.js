const CONFIG = {
  images: [
    "./images/javascript.png",
    "./images/next.webp",
    "./images/nodejs.png",
    "./images/react.png",
    "./images/tailwind.jpg",
    "./images/ts.png",
  ],
  radiusX: 340,
  radiusY: 80,
  rotation: -8,
  duration: 30,
  itemSize: 90,
  depth: 0.6,
  itemRadius: 14,
  shadow: 0.3,
  hoverScale: 1.08,
  hoverSpeed: 0.3,
  showPath: true,
  draggable: true,
  clickToFront: true,
  paused: false,
  intro: true,
};

const root = document.querySelector("#orbit");
const svg = document.querySelector("#orbit-svg");
const ellipse = document.querySelector("#orbit-path");
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let items = [];
let angleOffset = 0;
let lastTime = 0;
let animationFrame = null;
let hovered = false;
let dragStart = null;
let manualOffset = 0;
let introStart = null;
let introFinished = !CONFIG.intro || reduceMotion;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (value) => ((value % 1) + 1) % 1;

root.style.setProperty("--orbit-radius", `${CONFIG.itemRadius}px`);
root.style.setProperty("--orbit-shadow", String(clamp(CONFIG.shadow, 0, 1)));
root.style.setProperty("--orbit-hover-scale", String(CONFIG.hoverScale));

if (!CONFIG.showPath) svg.style.visibility = "hidden";

CONFIG.images.forEach((src, index) => {
  const item = document.createElement("div");
  item.className = "orbit-item";
  item.dataset.index = String(index);
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `Orbiting image ${index + 1}`);

  const inner = document.createElement("div");
  inner.className = "orbit-item-inner";

  const img = document.createElement("img");
  img.className = "orbit-image";
  img.src = src;
  img.alt = `Orbiting image ${index + 1}`;
  img.draggable = false;
  img.loading = "lazy";

  inner.appendChild(img);
  item.appendChild(inner);
  root.appendChild(item);
  items.push(item);

  item.addEventListener("click", () => {
    if (performance.now() < (root._suppressClickUntil || 0)) return;
    if (CONFIG.clickToFront) {
      const current = getProgress() + index / items.length;
      const front = 0.25; // front-most point on the ellipse
      let delta = front - wrap(current);
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      manualOffset += delta;
    }
  });

  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      item.click();
    }
  });
});

function getGeometry() {
  const rect = root.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const mobile = width < 640;
  const rx = Math.min(CONFIG.radiusX, width * (mobile ? 0.42 : 0.43));
  const ry = Math.min(CONFIG.radiusY, height * (mobile ? 0.28 : 0.3));
  return {width, height, cx: width / 2, cy: height / 2, rx, ry};
}

function updatePath(g) {
  ellipse.setAttribute("cx", g.cx);
  ellipse.setAttribute("cy", g.cy);
  ellipse.setAttribute("rx", g.rx);
  ellipse.setAttribute("ry", g.ry);
  ellipse.setAttribute(
    "transform",
    `rotate(${CONFIG.rotation} ${g.cx} ${g.cy})`,
  );
  ellipse.setAttribute("stroke-width", "1.5");
}

function pointAt(progress, g) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle) * g.rx;
  const y = Math.sin(angle) * g.ry;
  const rotation = (CONFIG.rotation * Math.PI) / 180;
  return {
    x: g.cx + x * Math.cos(rotation) - y * Math.sin(rotation),
    y: g.cy + x * Math.sin(rotation) + y * Math.cos(rotation),
  };
}

function getProgress() {
  return angleOffset + manualOffset;
}

function render(now) {
  const g = getGeometry();
  updatePath(g);

  const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
  lastTime = now;

  if (!CONFIG.paused && !reduceMotion && CONFIG.duration > 0) {
    const speed = hovered ? CONFIG.hoverSpeed : 1;
    angleOffset += (elapsed * speed) / CONFIG.duration;
  }

  if (CONFIG.intro && !introFinished) {
    if (introStart === null) introStart = now;
    if (now - introStart > 1300) introFinished = true;
  }

  const introProgress = introFinished
    ? 1
    : clamp((now - (introStart || now)) / 1000, 0, 1);
  const introScale = 0.72 + 0.28 * introProgress;
  const introOpacity = introProgress * introProgress * (3 - 2 * introProgress);

  items.forEach((item, index) => {
    const progress = wrap(getProgress() + index / items.length);
    const point = pointAt(progress, g);

    const depthPosition = clamp((point.y - g.cy) / Math.max(1, g.ry), -1, 1);
    const weight = (depthPosition + 1) / 2;
    const scale =
      (1 + CONFIG.depth * (0.3 * weight - 0.45 * (1 - weight))) * introScale;
    const opacity = (1 - CONFIG.depth * 0.55 * (1 - weight)) * introOpacity;
    const size = Math.min(
      CONFIG.itemSize,
      window.innerWidth < 640 ? 62 : CONFIG.itemSize,
    );

    item.style.width = `${size}px`;
    item.style.height = `${size}px`;
    item.style.transform = `translate3d(${point.x - size / 2}px, ${point.y - size / 2}px, 0) scale(${scale})`;
    item.style.opacity = String(opacity);
    item.style.zIndex = String(Math.round(10 + weight * 100));
  });

  animationFrame = requestAnimationFrame(render);
}

root.addEventListener("pointerenter", () => {
  hovered = true;
});
root.addEventListener("pointerleave", () => {
  hovered = false;
  dragStart = null;
  root.removeAttribute("data-dragging");
});

root.addEventListener("pointerdown", (event) => {
  if (!CONFIG.draggable || event.button !== 0) return;
  if (event.target.closest(".orbit-center-content")) return;
  dragStart = {x: event.clientX, startOffset: manualOffset, moved: false};
  root.setPointerCapture?.(event.pointerId);
});

root.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  if (Math.abs(dx) > 5) {
    dragStart.moved = true;
    root.setAttribute("data-dragging", "");
    manualOffset =
      dragStart.startOffset + (dx / Math.max(1, root.clientWidth)) * 0.8;
  }
});

function endDrag() {
  if (dragStart?.moved) root._suppressClickUntil = performance.now() + 350;
  dragStart = null;
  root.removeAttribute("data-dragging");
}
root.addEventListener("pointerup", endDrag);
root.addEventListener("pointercancel", endDrag);

if (reduceMotion) {
  CONFIG.paused = true;
}

if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(render);

window.addEventListener("resize", () => {});
