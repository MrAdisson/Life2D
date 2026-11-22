import { createCamera, viewProjection } from "./camera.js";
import {
  TRAIL_VERTEX_FLOATS,
  createTrails,
  displayOf,
  trailsAvailable,
} from "./display.js";

// Rendu WebGL 2 des particules : un disque par particule (dessin instancié),
// dans l'ordre reçu (les plus massives d'abord, donc dessous). En 3D, chaque
// disque est ombré comme une sphère éclairée (normale et lumière calculées dans
// le fragment shader, sans maillage). Le fond du
// canevas reste transparent : on voit le fond sombre de la page, comme avant.

// Même valeur que dans simulation-host.js (non importé : ce module tourne sur
// le thread principal, sans le moteur).
export const POSITION_STRIDE = 3;

const VERTEX = `#version 300 es
in vec2 a_corner;
in vec3 a_position;
in float a_radius;
in vec4 a_color;
in float a_emissive;
uniform vec2 u_size;
uniform bool u_view3d;
// Vue 3D : matrice de la caméra orbitale (camera.js), focale en pixels et
// distances de la boîte la plus proche / la plus lointaine (teinte).
uniform mat4 u_matrix;
uniform float u_focal;
uniform vec2 u_shade;
// Facteur global sur le rayon d'affichage ; matrice de vue et position (repère
// de la caméra) du premier astre émissif, source de lumière des autres.
uniform float u_scale;
uniform mat4 u_view;
uniform vec3 u_sun;
uniform bool u_hasSun;
out vec3 v_light;
out float v_emissive;
out vec2 v_local;
out float v_shade;
out float v_radius;
out float v_lit;
out vec4 v_color;
void main() {
  v_color = a_color;
  v_lit = u_view3d ? 1.0 : 0.0;
  v_emissive = u_view3d ? a_emissive : 0.0;
  v_light = normalize(vec3(-0.45, 0.55, 0.7));
  if (!u_view3d) {
    // Vue 2D (inchangée) : marge d'un pixel pour adoucir le bord du disque.
    vec2 local = a_corner * (a_radius + 1.0);
    vec2 p = a_position.xy + local;
    v_local = local;
    v_radius = a_radius;
    v_shade = 1.0;
    gl_Position = vec4(p.x / u_size.x * 2.0 - 1.0, 1.0 - p.y / u_size.y * 2.0, 0.0, 1.0);
    return;
  }
  // Vue 3D : disque toujours face à la caméra, de taille apparente
  // inversement proportionnelle à la distance ; plus sombre au fond.
  vec4 clip = u_matrix * vec4(a_position, 1.0);
  if (clip.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // derrière la caméra : hors champ
    return;
  }
  if (u_hasSun && a_emissive < 0.5) {
    // Lumière venue de l'astre émissif (la profondeur vue croît vers le fond,
    // la normale d'une face visible pointe vers la caméra : z inversé).
    vec3 d = u_sun - (u_view * vec4(a_position, 1.0)).xyz;
    if (length(d) > 0.0001) v_light = normalize(vec3(d.xy, -d.z));
  }
  float radius = a_radius * u_scale * u_focal / clip.w;
  vec2 local = a_corner * (radius + 1.0);
  v_local = local;
  v_radius = radius;
  float t = clamp((clip.w - u_shade.x) / (u_shade.y - u_shade.x), 0.0, 1.0);
  v_shade = 1.0 - 0.6 * t;
  gl_Position = clip + vec4(local * 2.0 / u_size * clip.w, 0.0, 0.0);
}`;

// Contour de la boîte de simulation en 3D (12 arêtes).
const BOX_VERTEX = `#version 300 es
in vec3 a_vertex;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_vertex, 1.0);
}`;

const BOX_FRAGMENT = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
  outColor = vec4(0.22, 0.24, 0.3, 0.6);
}`;

// Traînées d'orbite (vue 3D) : segments de la couleur du corps, de plus en plus
// opaques vers la position actuelle.
const TRAIL_VERTEX = `#version 300 es
in vec3 a_vertex;
in vec4 a_color;
uniform mat4 u_matrix;
out vec4 v_color;
void main() {
  v_color = a_color;
  gl_Position = u_matrix * vec4(a_vertex, 1.0);
}`;

const TRAIL_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_local;
in float v_radius;
in float v_shade;
in float v_lit;
in float v_emissive;
in vec3 v_light;
in vec4 v_color;
out vec4 outColor;
void main() {
  float coverage = clamp(v_radius - length(v_local) + 0.5, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  float alpha = v_color.a * coverage;
  vec3 rgb = v_color.rgb * v_shade;
  if (v_emissive > 0.5) {
    // Astre émissif : couleur vive, sans ombrage ni teinte de profondeur.
    rgb = min(v_color.rgb * 1.1 + 0.08, 1.0);
  } else if (v_lit > 0.5) {
    // Sphère : normale du point visible, lumière fixe venant du haut à gauche
    // devant la scène (ombrage de Lambert, lumière ambiante, reflet discret).
    vec2 q = v_local / max(v_radius, 0.5);
    float r2 = min(dot(q, q), 1.0);
    vec3 n = vec3(q, sqrt(1.0 - r2));
    vec3 light = normalize(v_light);
    float diffuse = max(dot(n, light), 0.0);
    float specular = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    rgb = rgb * (0.18 + 0.95 * diffuse) + vec3(0.25 * specular * v_shade);
  }
  outColor = vec4(rgb * alpha, alpha);
}`;

// Couleur CSS (nom, #hex, rgb()...) -> [r, g, b, a] en octets, via le style
// calculé par le navigateur.
export const cssColorToRgba = (color) => {
  const probe = document.createElement("span");
  probe.style.color = color;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const [r = 0, g = 0, b = 0, a = 1] = (computed.match(/[\d.]+/g) || []).map(
    Number,
  );
  return [r, g, b, Math.round(a * 255)];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
};

// palette : couleur CSS de chaque type ; types, radii : type et rayon de chaque
// particule dans l'ordre d'affichage. Renvoie null si WebGL 2 est indisponible.
export const createRenderer = (canvas, initial) => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: true,
  });
  if (!gl) return null;

  const link = (vertex, fragment) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  };

  // Contour de la boîte (vue 3D seulement).
  const boxProgram = link(BOX_VERTEX, BOX_FRAGMENT);
  const boxMatrix = gl.getUniformLocation(boxProgram, "u_matrix");
  const boxVao = gl.createVertexArray();
  gl.bindVertexArray(boxVao);
  const boxBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
  const boxLocation = gl.getAttribLocation(boxProgram, "a_vertex");
  gl.enableVertexAttribArray(boxLocation);
  gl.vertexAttribPointer(boxLocation, 3, gl.FLOAT, false, 0, 0);
  const setBox = (w, h, d) => {
    const c = [
      [0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0],
      [0, 0, d], [w, 0, d], [w, h, d], [0, h, d],
    ];
    const edges = [
      0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
    ];
    gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges.flatMap((k) => c[k])), gl.STATIC_DRAW);
  };

  // Traînées : sommets x, y, z, r, g, b, a reconstruits à chaque image.
  const trailProgram = link(TRAIL_VERTEX, TRAIL_FRAGMENT);
  const trailMatrix = gl.getUniformLocation(trailProgram, "u_matrix");
  const trailVao = gl.createVertexArray();
  gl.bindVertexArray(trailVao);
  const trailBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
  const trailStride = TRAIL_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const trailVertex = gl.getAttribLocation(trailProgram, "a_vertex");
  gl.enableVertexAttribArray(trailVertex);
  gl.vertexAttribPointer(trailVertex, 3, gl.FLOAT, false, trailStride, 0);
  const trailColor = gl.getAttribLocation(trailProgram, "a_color");
  gl.enableVertexAttribArray(trailColor);
  gl.vertexAttribPointer(trailColor, 4, gl.FLOAT, false, trailStride, 12);

  const program = link(VERTEX, FRAGMENT);
  gl.useProgram(program);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const attribute = (
    name,
    size,
    type,
    { divisor, normalized, usage, data, stride = 0 },
  ) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, normalized ?? false, stride, 0);
    gl.vertexAttribDivisor(location, divisor);
    return buffer;
  };

  const corners = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  attribute("a_corner", 2, gl.FLOAT, { divisor: 0, data: corners });
  const radiusBuffer = attribute("a_radius", 1, gl.FLOAT, { divisor: 1 });
  const colorBuffer = attribute("a_color", 4, gl.UNSIGNED_BYTE, {
    divisor: 1,
    normalized: true,
  });
  const emissiveBuffer = attribute("a_emissive", 1, gl.UNSIGNED_BYTE, { divisor: 1 });
  // Tampon de positions : x, y, z par particule (z = 0 en 2D).
  const positionBuffer = attribute("a_position", 3, gl.FLOAT, {
    divisor: 1,
    stride: POSITION_STRIDE * Float32Array.BYTES_PER_ELEMENT,
  });

  let count = 0;
  let view3d = false;
  let depth = 0;
  // Caméra de la vue 3D : remplacée par celle de la page (setCamera).
  let camera = createCamera();
  const uniform = (name) => gl.getUniformLocation(program, name);
  const view3dLocation = uniform("u_view3d");
  const matrixLocation = uniform("u_matrix");
  const focalLocation = uniform("u_focal");
  const shadeLocation = uniform("u_shade");
  const scaleLocation = uniform("u_scale");
  const viewLocation = uniform("u_view");
  const sunLocation = uniform("u_sun");
  const hasSunLocation = uniform("u_hasSun");

  // Rendu des astres (vue 3D) : réglage `display` relu à chaque image.
  let readDisplay = () => undefined;
  let current = new Float32Array(0); // dernières positions reçues
  let radii = new Float32Array(0);
  let colors = []; // [r, g, b, a] (0 à 1) de chaque particule
  let sun = -1; // indice du premier astre émissif
  let trails = null;
  let trailKey = "";
  let trailData = new Float32Array(0);
  let lastView = null;
  let lastScale = 1;
  // (Re)charge la description des particules : appelé à la création, puis à
  // chaque changement de types ou de nombres.
  const load = (particles) => {
    count = particles.count;
    // Vue 3D si le Worker simule en 3D ; sinon vue plane d'avant.
    view3d = particles.dimensions === 3 && particles.depth > 0;
    depth = view3d ? particles.depth : 0;
    gl.useProgram(program);
    gl.uniform1i(view3dLocation, view3d ? 1 : 0);
    if (view3d) setBox(canvas.width, canvas.height, depth);
    const rgba = particles.palette.map(cssColorToRgba);
    const bytes = new Uint8Array(count * 4);
    for (let k = 0; k < count; k++) bytes.set(rgba[particles.types[k]], k * 4);
    colors = Array.from({ length: count }, (_, k) =>
      Array.from(bytes.subarray(k * 4, k * 4 + 4), (v) => v / 255),
    );
    radii = particles.radii;
    const emissive = particles.emissive ?? new Uint8Array(count);
    sun = emissive.indexOf(1);
    current = new Float32Array(count * POSITION_STRIDE);
    trails = null;
    trailKey = "";
    gl.bindBuffer(gl.ARRAY_BUFFER, emissiveBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, emissive, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.radii, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      count * POSITION_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      gl.DYNAMIC_DRAW,
    );
  };
  load(initial);

  gl.uniform2f(gl.getUniformLocation(program, "u_size"), canvas.width, canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.depthFunc(gl.LEQUAL);

  return {
    load,
    // Vrai si la vue en cours est en 3D (la page n'active l'orbite qu'alors).
    get view3d() {
      return view3d;
    },
    // Boîte de la vue 3D (pixels), pour les commandes de la caméra.
    get box() {
      return { width: canvas.width, height: canvas.height, depth };
    },
    // camera : { yaw, pitch, zoom } (camera.js), lue à chaque image.
    setCamera(value) {
      camera = value;
    },
    // Réglage d'affichage des astres : fonction qui renvoie `settings.display`
    // (relue à chaque image).
    setDisplay(read) {
      readDisplay = read;
    },
    // Position écran (pixels du canevas) et rayon apparent du corps k dans la
    // dernière image 3D dessinée ; null si la vue est plane ou le corps est
    // derrière la caméra.
    screenPosition(k) {
      if (!view3d || !lastView || k < 0 || k >= count) return null;
      const m = lastView.matrix;
      const x = current[k * 3], y = current[k * 3 + 1], z = current[k * 3 + 2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (!(w > 0)) return null;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      return {
        x: ((cx / w + 1) / 2) * canvas.width,
        y: ((1 - cy / w) / 2) * canvas.height,
        radius: (radii[k] * lastScale * lastView.focal) / w,
      };
    },
    // positions : [x0, y0, z0, x1, y1, z1, ...] dans l'ordre d'affichage.
    upload(positions) {
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      current.set(positions.subarray(0, current.length));
      if (view3d) {
        const d = displayOf({ display: readDisplay() });
        if (d.trails && trailsAvailable(count)) {
          const key = `${count}:${d.trailLength}`;
          if (key !== trailKey) {
            trails = createTrails(count, d.trailLength);
            trailKey = key;
            trailData = new Float32Array(trails.maxVertices * TRAIL_VERTEX_FLOATS);
          }
          trails.push(current);
        } else {
          trails = null;
          trailKey = "";
        }
      }
    },
    // Libère le contexte WebGL (la page en change à chaque simulation lancée).
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
    draw() {
      // Vue 3D : test de profondeur ; vue 2D : ordre de dessin (comme avant).
      if (view3d) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (view3d) {
        // Caméra centrée sur le corps suivi.
        const f = camera.follow;
        camera.target =
          Number.isInteger(f) && f >= 0 && f < count
            ? [current[f * 3], current[f * 3 + 1], current[f * 3 + 2]]
            : null;
        const view = viewProjection(camera, {
          width: canvas.width,
          height: canvas.height,
          depth,
        });
        // Contour d'abord, sans écrire la profondeur : il reste visible à
        // travers les particules mais derrière elles.
        gl.depthMask(false);
        gl.useProgram(boxProgram);
        gl.uniformMatrix4fv(boxMatrix, false, view.matrix);
        gl.bindVertexArray(boxVao);
        gl.drawArrays(gl.LINES, 0, 24);
        // Traînées : sous les particules, sans écrire la profondeur.
        if (trails && trails.filled > 1) {
          const n = trails.write(trailData, colors);
          gl.useProgram(trailProgram);
          gl.uniformMatrix4fv(trailMatrix, false, view.matrix);
          gl.bindVertexArray(trailVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            trailData.subarray(0, n * TRAIL_VERTEX_FLOATS),
            gl.DYNAMIC_DRAW,
          );
          gl.drawArrays(gl.LINES, 0, n);
        }
        gl.depthMask(true);
        gl.useProgram(program);
        lastView = view;
        lastScale = displayOf({ display: readDisplay() }).sizeFactor;
        gl.uniform1f(scaleLocation, lastScale);
        gl.uniformMatrix4fv(viewLocation, false, view.view);
        gl.uniform1i(hasSunLocation, sun >= 0 ? 1 : 0);
        if (sun >= 0) {
          const v = view.view;
          const x = current[sun * 3], y = current[sun * 3 + 1], z = current[sun * 3 + 2];
          gl.uniform3f(
            sunLocation,
            v[0] * x + v[4] * y + v[8] * z + v[12],
            v[1] * x + v[5] * y + v[9] * z + v[13],
            v[2] * x + v[6] * y + v[10] * z + v[14],
          );
        }
        gl.uniformMatrix4fv(matrixLocation, false, view.matrix);
        gl.uniform1f(focalLocation, view.focal);
        gl.uniform2f(shadeLocation, ...view.shade);
      }
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
  };
};
