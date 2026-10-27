/*! Legacy force and quadtree algorithms adapted from D3 v3.5.17.
 * Source: https://github.com/d3/d3/tree/v3.5.17/src/layout/force.js
 * and src/geom/quadtree.js. Modern timer/dispatch and canonical fixed targets
 * are the runtime adapters; drag and zoom remain application-owned.
 * Copyright (c) 2010-2016, Michael Bostock
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * The name Michael Bostock may not be used to endorse or promote products
 *   derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
export function createLegacyPackedForceKernel(input, random) {
  const { count: n, links, distances, strengths, charges } = input;
  let { size, gravity, friction, theta2, chargeDistance2, chargeEnabled } =
    input;
  // Distinct labels can share property-backed coordinates; duplicate nodes also
  // retain identity separately from their coordinate owner and charge index.
  const { owners, identities } = input;
  const state = {};
  for (const field of ["x", "y", "px", "py", "weight", "fx", "fy"]) {
    state[field] = new Float64Array(input[field]);
  }
  state.fixed = new Uint8Array(input.fixed);
  const { x, y, px, py, weight, fx, fy, fixed } = state;
  let alpha = input.alpha,
    capacity = 0,
    used = 0,
    leaf,
    point,
    pointIdentity,
    children,
    tx,
    ty,
    cx,
    cy,
    charge,
    pointCharge;
  const stack = [],
    left = [],
    right = [];
  function grow() {
    const next = Math.max(64, capacity * 2);
    const extend = (old, Type, multiple = 1) => {
      const value = new Type(next * multiple);
      if (old) {
        value.set(old);
      }
      return value;
    };
    leaf = extend(leaf, Uint8Array);
    point = extend(point, Int32Array);
    pointIdentity = extend(pointIdentity, Int32Array);
    children = extend(children, Int32Array, 4);
    tx = extend(tx, Float64Array);
    ty = extend(ty, Float64Array);
    cx = extend(cx, Float64Array);
    cy = extend(cy, Float64Array);
    charge = extend(charge, Float64Array);
    pointCharge = extend(pointCharge, Float64Array);
    capacity = next;
  }
  function allocate() {
    if (used === capacity) {
      grow();
    }
    const cell = used++;
    leaf[cell] = 1;
    point[cell] = -1;
    pointIdentity[cell] = -1;
    children.fill(-1, cell * 4, cell * 4 + 4);
    tx[cell] = ty[cell] = NaN;
    cx[cell] = cy[cell] = charge[cell] = pointCharge[cell] = 0;
    return cell;
  }
  function insert(cell, p, xx, yy, x1, y1, x2, y2) {
    if (isNaN(xx) || isNaN(yy)) {
      return;
    }
    if (leaf[cell]) {
      if (point[cell] !== -1) {
        const nx = tx[cell],
          ny = ty[cell];
        if (Math.abs(nx - xx) + Math.abs(ny - yy) < 0.01) {
          insertChild(cell, p, xx, yy, x1, y1, x2, y2);
        } else {
          const oldPoint = point[cell];
          point[cell] = -1;
          pointIdentity[cell] = -1;
          tx[cell] = ty[cell] = NaN;
          insertChild(cell, oldPoint, nx, ny, x1, y1, x2, y2);
          insertChild(cell, p, xx, yy, x1, y1, x2, y2);
        }
      } else {
        tx[cell] = xx;
        ty[cell] = yy;
        point[cell] = p;
        pointIdentity[cell] = identities[p];
      }
    } else {
      insertChild(cell, p, xx, yy, x1, y1, x2, y2);
    }
  }
  function insertChild(cell, p, xx, yy, x1, y1, x2, y2) {
    const xm = (x1 + x2) * 0.5,
      ym = (y1 + y2) * 0.5;
    const r = xx >= xm,
      b = yy >= ym,
      slot = cell * 4 + (b ? 2 : 0) + (r ? 1 : 0);
    leaf[cell] = 0;
    let child = children[slot];
    if (child === -1) {
      child = allocate();
      children[slot] = child;
    }
    insert(
      child,
      p,
      xx,
      yy,
      r ? xm : x1,
      b ? ym : y1,
      r ? x2 : xm,
      b ? y2 : ym,
    );
  }
  function accumulate(cell) {
    let centerX = 0,
      centerY = 0;
    charge[cell] = 0;
    if (!leaf[cell]) {
      for (let i = 0; i < 4; i++) {
        const child = children[cell * 4 + i];
        if (child === -1) {
          continue;
        }
        accumulate(child);
        charge[cell] += charge[child];
        centerX += charge[child] * cx[child];
        centerY += charge[child] * cy[child];
      }
    }
    const p = point[cell];
    if (p !== -1) {
      if (!leaf[cell]) {
        x[owners[p]] += random() - 0.5;
        y[owners[p]] += random() - 0.5;
      }
      const k = alpha * charges[p];
      charge[cell] += pointCharge[cell] = k;
      centerX += k * x[owners[p]];
      centerY += k * y[owners[p]];
    }
    cx[cell] = centerX / charge[cell];
    cy[cell] = centerY / charge[cell];
  }
  function repulse(x1, x2) {
    for (let i = 0; i < n; i++) {
      if (fixed[i]) {
        continue;
      }
      const nodeX = x[owners[i]],
        nodeY = y[owners[i]],
        nodeIdentity = identities[i];
      let previousX = px[owners[i]],
        previousY = py[owners[i]],
        top = 0;
      stack[0] = 0;
      left[0] = x1;
      right[0] = x2;
      while (top >= 0) {
        const cell = stack[top],
          lo = left[top],
          hi = right[top];
        top--;
        if (pointIdentity[cell] !== nodeIdentity) {
          const dx = cx[cell] - nodeX,
            dy = cy[cell] - nodeY,
            dw = hi - lo,
            dn = dx * dx + dy * dy;
          if ((dw * dw) / theta2 < dn) {
            if (dn < chargeDistance2) {
              const k = charge[cell] / dn;
              previousX -= dx * k;
              previousY -= dy * k;
            }
            continue;
          }
          if (point[cell] !== -1 && dn && dn < chargeDistance2) {
            const k = pointCharge[cell] / dn;
            previousX -= dx * k;
            previousY -= dy * k;
          }
        }
        // Preserve legacy zero-sum subtree pruning, including mixed signed charges.
        if (!charge[cell]) {
          continue;
        }
        const midpoint = (lo + hi) * 0.5;
        for (let j = 3; j >= 0; j--) {
          const child = children[cell * 4 + j];
          if (child === -1) {
            continue;
          }
          top++;
          stack[top] = child;
          const r = j === 1 || j === 3;
          left[top] = r ? midpoint : lo;
          right[top] = r ? hi : midpoint;
        }
      }
      px[owners[i]] = previousX;
      py[owners[i]] = previousY;
    }
  }
  return {
    state,
    charges,
    owners,
    links,
    refresh(parameters) {
      ({ friction, theta2, chargeDistance2 } = parameters);
    },
    step(parameters) {
      ({
        alpha,
        size,
        gravity,
        friction,
        theta2,
        chargeDistance2,
        chargeEnabled,
      } = parameters);
      for (let i = 0; i < distances.length; i++) {
        const s = links[i * 2],
          t = links[i * 2 + 1];
        let dx = x[owners[t]] - x[owners[s]],
          dy = y[owners[t]] - y[owners[s]],
          l = dx * dx + dy * dy,
          k;
        if (l) {
          l = (alpha * strengths[i] * ((l = Math.sqrt(l)) - distances[i])) / l;
          dx *= l;
          dy *= l;
          x[owners[t]] -=
            dx *
            (k =
              weight[s] + weight[t]
                ? weight[s] / (weight[s] + weight[t])
                : 0.5);
          y[owners[t]] -= dy * k;
          x[owners[s]] += dx * (k = 1 - k);
          y[owners[s]] += dy * k;
        }
      }
      const k = alpha * gravity;
      if (k) {
        const centerX = size[0] / 2,
          centerY = size[1] / 2;
        for (let i = 0; i < n; i++) {
          x[owners[i]] += (centerX - x[owners[i]]) * k;
          y[owners[i]] += (centerY - y[owners[i]]) * k;
        }
      }
      if (chargeEnabled) {
        let x1 = Infinity,
          y1 = Infinity,
          x2 = -Infinity,
          y2 = -Infinity;
        for (let i = 0; i < n; i++) {
          if (x[owners[i]] < x1) {
            x1 = x[owners[i]];
          }
          if (x[owners[i]] > x2) {
            x2 = x[owners[i]];
          }
          if (y[owners[i]] < y1) {
            y1 = y[owners[i]];
          }
          if (y[owners[i]] > y2) {
            y2 = y[owners[i]];
          }
        }
        const dx = x2 - x1,
          dy = y2 - y1;
        if (dx > dy) {
          y2 = y1 + dx;
        } else {
          x2 = x1 + dy;
        }
        used = 0;
        allocate();
        for (let i = 0; i < n; i++) {
          insert(0, i, x[owners[i]], y[owners[i]], x1, y1, x2, y2);
        }
        accumulate(0);
        repulse(x1, x2);
      }
      for (let i = 0; i < n; i++) {
        if (fixed[i]) {
          if (Number.isFinite(fx[i])) {
            px[owners[i]] = fx[i];
          }
          if (Number.isFinite(fy[i])) {
            py[owners[i]] = fy[i];
          }
          x[owners[i]] = px[owners[i]];
          y[owners[i]] = py[owners[i]];
        } else {
          x[owners[i]] -=
            (px[owners[i]] - (px[owners[i]] = x[owners[i]])) * friction;
          y[owners[i]] -=
            (py[owners[i]] - (py[owners[i]] = y[owners[i]])) * friction;
        }
      }
    },
    statistics() {
      return {
        cells: used,
        capacity,
        treeBytes: capacity * (1 + 4 + 4 + 16 + 6 * 8),
      };
    },
  };
}
