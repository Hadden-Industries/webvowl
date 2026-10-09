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
export function createLegacyQuadtree(data) {
  let x1_ = Infinity,
    y1_ = Infinity,
    x2_ = -Infinity,
    y2_ = -Infinity;
  const xs = [],
    ys = [];
  for (const d of data) {
    if (d.x < x1_) {
      x1_ = d.x;
    }
    if (d.y < y1_) {
      y1_ = d.y;
    }
    if (d.x > x2_) {
      x2_ = d.x;
    }
    if (d.y > y2_) {
      y2_ = d.y;
    }
    xs.push(d.x);
    ys.push(d.y);
  }
  // Squarify the bounds.
  const dx = x2_ - x1_,
    dy = y2_ - y1_;
  if (dx > dy) {
    y2_ = y1_ + dx;
  } else {
    x2_ = x1_ + dy;
  }

  // Recursively inserts the specified point p at the node n or one of its
  // descendants. The bounds are defined by [x1, x2] and [y1, y2].
  function insert(n, d, x, y, x1, y1, x2, y2) {
    if (isNaN(x) || isNaN(y)) {
      return;
    } // ignore invalid points
    if (n.leaf) {
      const nx = n.x,
        ny = n.y;
      if (nx !== null && nx !== undefined) {
        // If the point at this leaf node is at the same position as the new
        // point we are adding, we leave the point associated with the
        // internal node while adding the new point to a child node. This
        // avoids infinite recursion.
        if (Math.abs(nx - x) + Math.abs(ny - y) < 0.01) {
          insertChild(n, d, x, y, x1, y1, x2, y2);
        } else {
          const nPoint = n.point;
          n.x = n.y = n.point = null;
          insertChild(n, nPoint, nx, ny, x1, y1, x2, y2);
          insertChild(n, d, x, y, x1, y1, x2, y2);
        }
      } else {
        ((n.x = x), (n.y = y), (n.point = d));
      }
    } else {
      insertChild(n, d, x, y, x1, y1, x2, y2);
    }
  }

  // Recursively inserts the specified point [x, y] into a descendant of node
  // n. The bounds are defined by [x1, x2] and [y1, y2].
  function insertChild(n, d, x, y, x1, y1, x2, y2) {
    // Compute the split point, and the quadrant in which to insert p.
    const xm = (x1 + x2) * 0.5,
      ym = (y1 + y2) * 0.5,
      right = x >= xm,
      below = y >= ym,
      i = (below ? 2 : 0) + (right ? 1 : 0);

    // Recursively insert into the child node.
    n.leaf = false;
    n = n.nodes[i] || (n.nodes[i] = createNode());

    // Update the bounds as we recurse.
    if (right) {
      x1 = xm;
    } else {
      x2 = xm;
    }
    if (below) {
      y1 = ym;
    } else {
      y2 = ym;
    }
    insert(n, d, x, y, x1, y1, x2, y2);
  }

  const root = createNode();
  root.visit = (f) => visit(f, root, x1_, y1_, x2_, y2_);
  for (let i = 0; i < data.length; ++i) {
    insert(root, data[i], xs[i], ys[i], x1_, y1_, x2_, y2_);
  }
  return root;
}
function createNode() {
  return { leaf: true, nodes: [], point: null, x: null, y: null };
}
function visit(f, node, x1, y1, x2, y2) {
  if (!f(node, x1, y1, x2, y2)) {
    const sx = (x1 + x2) * 0.5,
      sy = (y1 + y2) * 0.5,
      children = node.nodes;
    if (children[0]) {
      visit(f, children[0], x1, y1, sx, sy);
    }
    if (children[1]) {
      visit(f, children[1], sx, y1, x2, sy);
    }
    if (children[2]) {
      visit(f, children[2], x1, sy, sx, y2);
    }
    if (children[3]) {
      visit(f, children[3], sx, sy, x2, y2);
    }
  }
}
