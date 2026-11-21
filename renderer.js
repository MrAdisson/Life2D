// Rendu WebGL 2 des particules : un disque par particule (dessin instancié),
// dans l'ordre reçu (les plus massives d'abord, donc dessous). Le fond du
// canevas reste transparent : on voit le fond sombre de la page, comme avant.

const VERTEX = `#version 300 es
in vec2 a_corner;
in vec2 a_position;
in float a_radius;
in vec4 a_color;
uniform vec2 u_size;
out vec2 v_local;
out float v_radius;
out vec4 v_color;
void main() {
  // Marge d'un pixel pour adoucir le bord du disque.
  vec2 local = a_corner * (a_radius + 1.0);
  vec2 p = a_position + local;
  v_local = local;
  v_radius = a_radius;
  v_color = a_color;
  gl_Position = vec4(p.x / u_size.x * 2.0 - 1.0, 1.0 - p.y / u_size.y * 2.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_local;
in float v_radius;
in vec4 v_color;
out vec4 outColor;
void main() {
  float coverage = clamp(v_radius - length(v_local) + 0.5, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  float alpha = v_color.a * coverage;
  outColor = vec4(v_color.rgb * alpha, alpha);
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
  });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const attribute = (name, size, type, { divisor, normalized, usage, data }) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, normalized ?? false, 0, 0);
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
  const positionBuffer = attribute("a_position", 2, gl.FLOAT, { divisor: 1 });

  let count = 0;
  // (Re)charge la description des particules : appelé à la création, puis à
  // chaque changement de types ou de nombres.
  const load = (particles) => {
    count = particles.count;
    const rgba = particles.palette.map(cssColorToRgba);
    const colors = new Uint8Array(count * 4);
    for (let k = 0; k < count; k++) colors.set(rgba[particles.types[k]], k * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.radii, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      count * 2 * Float32Array.BYTES_PER_ELEMENT,
      gl.DYNAMIC_DRAW,
    );
  };
  load(initial);

  gl.uniform2f(gl.getUniformLocation(program, "u_size"), canvas.width, canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  return {
    load,
    // positions : [x0, y0, x1, y1, ...] dans l'ordre d'affichage.
    upload(positions) {
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    },
    draw() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
  };
};
