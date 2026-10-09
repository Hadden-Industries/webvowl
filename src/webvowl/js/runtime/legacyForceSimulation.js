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
import { dispatch, timer as createTimer } from "d3";
import { createLegacyQuadtree } from "./legacyForceQuadtree.js";

export function createLegacyForceSimulation({ random = Math.random } = {}) {
  const force = {},
    event = dispatch("tick", "end");
  let timer,
    size = [1, 1],
    alpha = 0,
    friction = 0.9,
    linkDistance = 20,
    linkStrength = 1,
    charge = -30,
    chargeDistance2 = Infinity,
    gravity = 0.1,
    theta2 = 0.64,
    nodes = [],
    links = [],
    distances,
    strengths,
    charges;
  function repulse(node) {
    return function (quad, x1, _, x2) {
      if (quad.point !== node) {
        const dx = quad.cx - node.x,
          dy = quad.cy - node.y,
          dw = x2 - x1,
          dn = dx * dx + dy * dy;
        if ((dw * dw) / theta2 < dn) {
          if (dn < chargeDistance2) {
            const k = quad.charge / dn;
            node.px -= dx * k;
            node.py -= dy * k;
          }
          return true;
        }
        if (quad.point && dn && dn < chargeDistance2) {
          const k = quad.pointCharge / dn;
          node.px -= dx * k;
          node.py -= dy * k;
        }
      }
      return !quad.charge;
    };
  }
  force.tick = function () {
    if ((alpha *= 0.99) < 0.005) {
      timer?.stop();
      timer = null;
      event.call("end", force, {
        type: "end",
        alpha: (alpha = 0),
      });
      return true;
    }
    const n = nodes.length,
      m = links.length;
    let q, i, o, s, t, l, k, x, y;
    for (i = 0; i < m; ++i) {
      o = links[i];
      s = o.source;
      t = o.target;
      x = t.x - s.x;
      y = t.y - s.y;
      if ((l = x * x + y * y)) {
        l = (alpha * strengths[i] * ((l = Math.sqrt(l)) - distances[i])) / l;
        x *= l;
        y *= l;
        t.x -=
          x *
          (k = s.weight + t.weight ? s.weight / (s.weight + t.weight) : 0.5);
        t.y -= y * k;
        s.x += x * (k = 1 - k);
        s.y += y * k;
      }
    }
    if ((k = alpha * gravity)) {
      x = size[0] / 2;
      y = size[1] / 2;
      i = -1;
      if (k) {
        while (++i < n) {
          o = nodes[i];
          o.x += (x - o.x) * k;
          o.y += (y - o.y) * k;
        }
      }
    }
    if (charge) {
      d3_layout_forceAccumulate(
        (q = createLegacyQuadtree(nodes)),
        alpha,
        charges,
        random,
      );
      i = -1;
      while (++i < n) {
        if (!(o = nodes[i]).fixed) {
          q.visit(repulse(o));
        }
      }
    }
    i = -1;
    while (++i < n) {
      o = nodes[i];
      if (o.fixed) {
        // Translate canonical drag/pin targets to position Verlet ownership.
        if (Number.isFinite(o.fx)) {
          o.px = o.fx;
        }
        if (Number.isFinite(o.fy)) {
          o.py = o.fy;
        }
        o.x = o.px;
        o.y = o.py;
      } else {
        o.x -= (o.px - (o.px = o.x)) * friction;
        o.y -= (o.py - (o.py = o.y)) * friction;
      }
    }
    event.call("tick", force, {
      type: "tick",
      alpha: alpha,
    });
  };
  force.nodes = function (x) {
    if (!arguments.length) {
      return nodes;
    }
    nodes = x;
    return force;
  };
  force.links = function (x) {
    if (!arguments.length) {
      return links;
    }
    links = x;
    return force;
  };
  force.size = function (x) {
    if (!arguments.length) {
      return size;
    }
    size = x;
    return force;
  };
  force.linkDistance = function (x) {
    if (!arguments.length) {
      return linkDistance;
    }
    linkDistance = typeof x === "function" ? x : +x;
    return force;
  };
  force.distance = force.linkDistance;
  force.linkStrength = function (x) {
    if (!arguments.length) {
      return linkStrength;
    }
    linkStrength = typeof x === "function" ? x : +x;
    return force;
  };
  force.friction = function (x) {
    if (!arguments.length) {
      return friction;
    }
    friction = +x;
    return force;
  };
  force.charge = function (x) {
    if (!arguments.length) {
      return charge;
    }
    charge = typeof x === "function" ? x : +x;
    return force;
  };
  force.chargeDistance = function (x) {
    if (!arguments.length) {
      return Math.sqrt(chargeDistance2);
    }
    chargeDistance2 = x * x;
    return force;
  };
  force.gravity = function (x) {
    if (!arguments.length) {
      return gravity;
    }
    gravity = +x;
    return force;
  };
  force.theta = function (x) {
    if (!arguments.length) {
      return Math.sqrt(theta2);
    }
    theta2 = x * x;
    return force;
  };
  force.alpha = function (x) {
    if (!arguments.length) {
      return alpha;
    }
    alpha = +x;
    return force;
  };
  force.alphaMin = () => 0.005;
  force.start = function () {
    const n = nodes.length,
      m = links.length,
      w = size[0],
      h = size[1];
    let i, neighbors, o;
    for (i = 0; i < n; ++i) {
      (o = nodes[i]).index = i;
      o.weight = 0;
    }
    for (i = 0; i < m; ++i) {
      o = links[i];
      if (typeof o.source === "number") {
        o.source = nodes[o.source];
      }
      if (typeof o.target === "number") {
        o.target = nodes[o.target];
      }
      ++o.source.weight;
      ++o.target.weight;
    }
    for (i = 0; i < n; ++i) {
      o = nodes[i];
      if (isNaN(o.x)) {
        o.x = position("x", w);
      }
      if (isNaN(o.y)) {
        o.y = position("y", h);
      }
      if (isNaN(o.px)) {
        o.px = o.x;
      }
      if (isNaN(o.py)) {
        o.py = o.y;
      }
    }
    distances = [];
    if (typeof linkDistance === "function") {
      for (i = 0; i < m; ++i) {
        distances[i] = +linkDistance.call(this, links[i], i);
      }
    } else {
      for (i = 0; i < m; ++i) {
        distances[i] = linkDistance;
      }
    }
    strengths = [];
    if (typeof linkStrength === "function") {
      for (i = 0; i < m; ++i) {
        strengths[i] = +linkStrength.call(this, links[i], i);
      }
    } else {
      for (i = 0; i < m; ++i) {
        strengths[i] = linkStrength;
      }
    }
    charges = [];
    if (typeof charge === "function") {
      for (i = 0; i < n; ++i) {
        charges[i] = +charge.call(this, nodes[i], i);
      }
    } else {
      for (i = 0; i < n; ++i) {
        charges[i] = charge;
      }
    }
    function position(dimension, size) {
      let j;
      if (!neighbors) {
        neighbors = new Array(n);
        for (j = 0; j < n; ++j) {
          neighbors[j] = [];
        }
        for (j = 0; j < m; ++j) {
          const o = links[j];
          neighbors[o.source.index].push(o.target);
          neighbors[o.target.index].push(o.source);
        }
      }
      const candidates = neighbors[i],
        l = candidates.length;
      let x;
      j = -1;
      while (++j < l) {
        if (!isNaN((x = candidates[j][dimension]))) {
          return x;
        }
      }
      return random() * size;
    }
    return force.resume();
  };
  force.resume = function () {
    alpha = 0.1;
    if (timer) {
      timer.stop();
    }
    timer = createTimer(() => force.tick());
    return force;
  };
  force.stop = function () {
    timer?.stop();
    timer = null;
    return force;
  };
  force.on = function (name, listener) {
    if (arguments.length === 1) {
      return event.on(name);
    }
    event.on(name, listener);
    return force;
  };
  return force;
}
function d3_layout_forceAccumulate(quad, alpha, charges, random) {
  let cx = 0,
    cy = 0;
  quad.charge = 0;
  if (!quad.leaf) {
    const nodes = quad.nodes,
      n = nodes.length;
    let i = -1,
      c;
    while (++i < n) {
      c = nodes[i];
      if (c === null || c === undefined) {
        continue;
      }
      d3_layout_forceAccumulate(c, alpha, charges, random);
      quad.charge += c.charge;
      cx += c.charge * c.cx;
      cy += c.charge * c.cy;
    }
  }
  if (quad.point) {
    if (!quad.leaf) {
      quad.point.x += random() - 0.5;
      quad.point.y += random() - 0.5;
    }
    const k = alpha * charges[quad.point.index];
    quad.charge += quad.pointCharge = k;
    cx += k * quad.point.x;
    cy += k * quad.point.y;
  }
  quad.cx = cx / quad.charge;
  quad.cy = cy / quad.charge;
}
