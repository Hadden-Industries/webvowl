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
import { createLegacyPackedForceKernel } from "./legacyPackedForceKernel.js";
import { Label } from "../elements/links/Label.js";

/** Run unchanged legacy steps; a frame may publish several steps as one drawing. */
export function createLegacyForceSimulation({
  random,
  maxStepsPerFrame = 1,
  frameBudgetMs = 8,
  shouldBatchSteps = () => true,
} = {}) {
  // Native randomness cannot observe model state. Supplied callbacks retain
  // current coordinates and live force parameters at each jitter call.
  const usesDefaultRandom = random === undefined;
  const randomSource = usesDefaultRandom ? Math.random : random;
  let packed;
  function releasePackedState() {
    packed = undefined;
  }
  const force = {},
    event = dispatch("step", "tick", "end");
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
  function preparePacked() {
    const indices = new Map(nodes.map((node, index) => [node, index]));
    const ownerIndices = new Map();
    const coordinateOwners = nodes.map((node) =>
      node instanceof Label ? node.property() : node,
    );
    const owners = Int32Array.from(coordinateOwners, (owner, i) => {
      if (!ownerIndices.has(owner)) {
        ownerIndices.set(owner, i);
      }
      return ownerIndices.get(owner);
    });
    const identities = Int32Array.from(nodes, (node) => indices.get(node));
    const input = {
      count: nodes.length,
      owners,
      identities,
      links: Int32Array.from(
        links.flatMap((link) => {
          assertEndpoint(link.source);
          assertEndpoint(link.target);
          return [indices.get(link.source), indices.get(link.target)];
        }),
      ),
      distances: Float64Array.from(links, (_, i) => distances[i]),
      strengths: Float64Array.from(links, (_, i) => strengths[i]),
      charges: Float64Array.from(nodes, (node) => charges[node.index]),
      ...Object.fromEntries(
        ["x", "y", "px", "py", "weight", "fx", "fy", "fixed"].map((key) => [
          key,
          new Float64Array(nodes.length),
        ]),
      ),
    };
    const current = createLegacyPackedForceKernel(input, () => {
      if (usesDefaultRandom) {
        return randomSource();
      }
      publish(current);
      const value = randomSource();
      importModel(current);
      current.refresh({ friction, theta2, chargeDistance2 });
      return value;
    });
    function assertEndpoint(node) {
      if (!indices.has(node)) {
        throw new Error(
          "Force links must refer to nodes in the current simulation",
        );
      }
    }
    current.nodes = nodes.slice();
    current.coordinateOwners = coordinateOwners;
    current.indices = indices;
    current.endpoints = links.flatMap((link) => [link.source, link.target]);
    return current;
  }
  // The existing model remains authoritative at every synchronous API/event
  // boundary. Import edits before each step and publish before projection/tick.
  function importModel(current) {
    const s = current.state;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (link.source !== current.endpoints[i * 2]) {
        updateEndpoint(i * 2, link.source);
      }
      if (link.target !== current.endpoints[i * 2 + 1]) {
        updateEndpoint(i * 2 + 1, link.target);
      }
    }
    function updateEndpoint(slot, node) {
      const index = current.indices.get(node);
      if (index === undefined) {
        throw new Error(
          "Force links must refer to nodes in the current simulation",
        );
      }
      current.endpoints[slot] = node;
      current.links[slot] = index;
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const owner = current.coordinateOwners[i];
      s.x[current.owners[i]] = owner.x;
      s.y[current.owners[i]] = owner.y;
      s.px[current.owners[i]] = owner.px;
      s.py[current.owners[i]] = owner.py;
      s.weight[i] = node.weight;
      s.fixed[i] = Boolean(node.fixed);
      s.fx[i] = Number.isFinite(owner.fx) ? owner.fx : NaN;
      s.fy[i] = Number.isFinite(owner.fy) ? owner.fy : NaN;
      current.charges[i] = charges[node.index];
    }
  }
  function publish(current) {
    const s = current.state;
    for (let i = 0; i < nodes.length; i++) {
      const owner = current.coordinateOwners[i];
      owner.x = s.x[current.owners[i]];
      owner.y = s.y[current.owners[i]];
      owner.px = s.px[current.owners[i]];
      owner.py = s.py[current.owners[i]];
    }
  }
  function step() {
    if ((alpha *= 0.99) < 0.005) {
      releasePackedState();
      timer?.stop();
      timer = null;
      event.call("end", force, {
        type: "end",
        alpha: (alpha = 0),
      });
      return true;
    }
    if (
      packed &&
      (packed.nodes.length !== nodes.length ||
        packed.links.length !== links.length * 2 ||
        nodes.some((node, i) => node !== packed.nodes[i]))
    ) {
      releasePackedState();
    }
    const current = (packed ??= preparePacked());
    importModel(current);
    current.step({
      alpha,
      size,
      gravity,
      friction,
      theta2,
      chargeDistance2,
      chargeEnabled: Boolean(charge),
    });
    publish(current);
    // Projection can affect the next numerical step (notably solitary labels).
    // It therefore runs even when this intermediate state is not drawn.
    event.call("step", force, {
      type: "step",
      alpha: alpha,
    });
  }
  function publishTick() {
    event.call("tick", force, {
      type: "tick",
      alpha: alpha,
    });
  }
  force.tick = function () {
    if (step()) {
      return true;
    }
    publishTick();
  };
  function advanceFrame() {
    const owner = timer;
    const startedAt = performance.now();
    let steps = 0;
    do {
      if (step() || timer !== owner) {
        return;
      }
      steps++;
      // Publish the last moving state before the next step emits `end`.
      if (alpha * 0.99 < 0.005) {
        break;
      }
    } while (
      steps < maxStepsPerFrame &&
      shouldBatchSteps() &&
      performance.now() - startedAt < frameBudgetMs
    );
    publishTick();
  }
  force.nodes = function (x) {
    if (!arguments.length) {
      return nodes;
    }
    releasePackedState();
    nodes = x;
    return force;
  };
  force.links = function (x) {
    if (!arguments.length) {
      return links;
    }
    releasePackedState();
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
    releasePackedState();
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
      return randomSource() * size;
    }
    return force.resume();
  };
  force.resume = function () {
    alpha = 0.1;
    if (timer) {
      timer.stop();
    }
    timer = createTimer(advanceFrame);
    return force;
  };
  force.stop = function () {
    releasePackedState();
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
