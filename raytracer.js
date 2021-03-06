// https://www.gabrielgambetta.com/computer-graphics-from-scratch/basic-ray-tracing.html#fnref1
const canvas = document.getElementById("scene");
const viewport = {
  width: 1,
  height: 1,
  depth: 1
};
const ctx = canvas.getContext("2d");
const camera = {
  position: [3, 0, 1],
  rotation: [
    [0.7071, 0, -0.7071],
    [0, 1, 0],
    [0.7071, 0, 0.7071],
  ],
};
const backgroundColor = [0, 0, 0];
const scene = {
  lights: [
    {
      type: 'ambient',
      intensity: 0.2
    },
    {
      type: 'point',
      intensity: 0.6,
      position: [2, 1, 0]
    },
    {
      type: 'directional',
      intensity: 0.2,
      direction: [1, 4, 4]
    },
  ],
  spheres: [
    {
      center: [0, -1, 3],
      radius: 1,
      color: [255, 0, 0],
      specular: 500,
      reflective: 0.2,
    },
    {
      center: [2, 0, 4],
      radius: 1,
      color: [0, 0, 255],
      specular: 500,
      reflective: 0.3,
    },
    {
      center: [-2, 0, 4],
      radius: 1,
      color: [0, 255, 0],
      specular: 10,
      reflective: 0.4,
    },
    {
      center: [0, -5001, 0],
      radius: 5000,
      color: [255, 255, 0],
      specular: 1000,
      reflective: 0.5,
    },
    {
      center: [0, 2, 6],
      radius: 1,
      color: [255, 0, 255],
      specular: -1,
      reflective: 0.5,
    },
  ]
};

function add(V1, V2) {
  return V1.map((val, i) => val + V2[i]);
}

function dot(V1, V2) {
  return sum(V1.map((val, i) => val * V2[i]));
}

function len(V) {
  return Math.sqrt(dot(V, V));
}

function scale(s, V) {
  return V.map(val => val * s);
}

function mul(M, V) {
  let res = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      res[i] += V[j] * M[i][j];
    }
  }
  return res;
}

function sub(V1, V2) {
  return V1.map((val, i) => val - V2[i]);
}

function sum(V) {
  return V.reduce((acc, val) => acc + val, 0);
}

function putPixel(x, y, [r, g, b, a = 255]) {
  // Change coordinates from canvas, where the origin is at the top left,
  // to viewport coordinates, where the origin is at the center
  x = canvas.width / 2 + x;
  y = canvas.height / 2 - y - 1;
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
  ctx.fillRect(x, y, 1, 1);
}

function canvasToViewport(x, y) {
  x = x * (viewport.width / canvas.width);
  y = y * (viewport.height / canvas.height);
  return [x, y, viewport.depth];
}

function computeLighting(P, N, V, s) {
  let i = 0;
  for (let light of scene.lights) {
    if (light.type === 'ambient') {
      i += light.intensity;
    } else {
      let L, tMax;
      if (light.type === 'point') {
        L = sub(light.position, P);
        // Only care up to 1.0. i.e. "L" because we don't care about objects
        // beyond the light
        tMax = 1.0;
      } else {
        L = light.direction;
        tMax = Infinity;
      }

      // Shadow check
      // Use 0.001, otherwise every object would cast shadows over itself
      let [sphere, t] = closestIntersection(P, L, 0.001, tMax);
      if (sphere) {
        continue;
      }

      // Diffuse
      // cos(a) of two vectors is the dot product divided by the product of the lengths
      let nDotL = dot(N, L);
      if (nDotL > 0) {
        i += light.intensity * nDotL / (len(N) * len(L));
      }

      // Specular
      // L = vector to the light source
      // R = reflection of L, across the normal
      // L = Lp + Ln
      // Lp = component of L perpendicular to N
      // Ln = component of L tangent to N
      // Ln = N*ln, N being the normal unit vector, and ln a scalar
      // ln = <N,L>
      // Ln = N<N,L>, projection of L onto N
      // Lp = L - Ln = L - N<N,L>
      // R = N<N,L> - L + N<N,L>
      // R = 2N<N,L> - L
      // cos(a)^s is used to model specularity, see note on cos above
      if (s !== -1) {
        let R = reflectRay(L, N);
        let rDotV = dot(R, V);
        if (rDotV > 0) {
          i += light.intensity * Math.pow(rDotV/(len(R) * len(V)), s);
        }
      }
    }
  }
  return i;
}

function intersectRaySphere(O, D, sphere) {
  // P = point on sphere, C = center
  // O = origin
  // D = V - O, vector from origin to point on the viewport, used for the "ray"
  // Equation for sphere
  // <P-C, P-C> = r^2
  // Equation for a ray from origin to point on the sphere
  // P = O + tD
  // Essentially substitute P in the first with the second equation,
  // and then rearrange so it solves for 0 and use the quadratic formula
  // <O + tD - C, O + tD - C> = r^2
  // <OC + tD, OC + tD> = r^2
  // Dot product is distributive, so:
  // <OC, OC> + <tD, OC> + <OC, tD> + <tD, tD> = r^2
  // <tD, tD> + 2<tD, OC> + <OC, OC> = r^2
  // t^2<D, D> + t*2<OC, D> + <OC, OC> = r^2
  // t^2<D, D> + t*2<OC, D> + <OC, OC> - r^2 = 0
  // k1 = <D, D>
  // k2 = 2<OC, D>
  // k3 = <OC, OC> - r^2
  // k1*t^2 + k2*t + k3 = 0
  let { center, radius } = sphere;
  let OC = sub(O, center);
  let k1 = dot(D, D);
  let k2 = 2 * dot(OC, D);
  let k3 = dot(OC, OC) - radius ** 2;
  let discriminant = k2 ** 2 - 4 * k1 * k3;
  if (discriminant < 0) {
    return [Infinity, Infinity];
  }
  discriminant = Math.sqrt(discriminant);
  let denominator = 2 * k1;
  return [
    (-k2 + discriminant) / denominator,
    (-k2 - discriminant) / denominator,
  ];
}

function closestIntersection(O, D, tMin, tMax) {
  let closestT = Infinity;
  let closestSphere = null;
  for (let sphere of scene.spheres) {
    let [t1, t2] = intersectRaySphere(O, D, sphere);
    if (t1 > tMin && t1 < tMax && t1 < closestT) {
      closestT = t1;
      closestSphere = sphere;
    }
    if (t2 > tMin && t2 < tMax && t2 < closestT) {
      closestT = t2;
      closestSphere = sphere;
    }
  }
  return [closestSphere, closestT];
}

function traceRay(O, D, tMin, tMax, depth = 3) {
  let [sphere, t] = closestIntersection(O, D, tMin, tMax);
  if (!sphere) return backgroundColor;
  let P = add(O, scale(t, D)); // P = O + tD
  let N = sub(P, sphere.center); // normal at point
  N = scale(1/len(N), N); // convert to unit vector
  let V = scale(-1, D); // reverse of direction is reflection to the viewport
  let localColor = scale(computeLighting(P, N, V, sphere.specular), sphere.color);
  // Bail if recursion limit is hit or the object isn't reflective
  let r = sphere.reflective;
  if (depth <= 0 || r <= 0) return localColor;

  let R = reflectRay(V, N);
  let reflectedColor = traceRay(P, R, 0.001, Infinity, depth - 1);
  return add(scale(1 - r, localColor), scale(r, reflectedColor));
}

function reflectRay(R, N) {
  return sub(scale(2 * dot(N, R), N), R);
}

function render() {
  const hw = Math.floor(canvas.width / 2);
  const hh = Math.floor(canvas.height / 2);
  for (let x = -hw; x < hw; x++) {
    for (let y = -hh; y < hh; y++) {
      const direction = mul(camera.rotation, canvasToViewport(x, y));
      const color = traceRay(camera.position, direction, 1, Infinity);
      putPixel(x, y, color);
    }
  }
}

render();
