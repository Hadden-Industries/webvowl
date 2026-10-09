export { Label };

// Reuse the force-field accessors across labels: D3 reads and writes these
// properties throughout each tick. Each label still owns the same descriptors.
const forceStateDescriptors = {
  x: {
    get() {
      return this.property().x;
    },
    set(value) {
      this.property().x = value;
    },
  },
  y: {
    get() {
      return this.property().y;
    },
    set(value) {
      this.property().y = value;
    },
  },
  px: {
    get() {
      return this.property().px;
    },
    set(value) {
      this.property().px = value;
    },
  },
  py: {
    get() {
      return this.property().py;
    },
    set(value) {
      this.property().py = value;
    },
  },
  vx: {
    get() {
      return this.property().vx;
    },
    set(value) {
      this.property().vx = value;
    },
  },
  vy: {
    get() {
      return this.property().vy;
    },
    set(value) {
      this.property().vy = value;
    },
  },
  fixed: {
    get() {
      const property = this.property();
      const inverseFixed = property.inverse()
        ? property.inverse().fixed
        : false;
      return property.fixed || inverseFixed;
    },
    set(value) {
      this.property().fixed = value;
    },
  },
  fx: {
    get() {
      return this.property().fx;
    },
    set(value) {
      this.property().fx = value;
    },
  },
  fy: {
    get() {
      return this.property().fy;
    },
    set(value) {
      this.property().fy = value;
    },
  },
};

/**
 * A label represents the element(s) which further describe a link.
 * It encapsulates the property and its inverse property.
 * @param property the property; the inverse is inferred
 * @param link the link this label belongs to
 */
function Label(property, link) {
  this.link = function () {
    return link;
  };

  this.property = function () {
    return property;
  };

  Object.defineProperties(this, forceStateDescriptors);
  this.frozen = property.frozen;
  this.locked = property.locked;
  this.pinned = property.pinned;
}

Label.prototype.actualRadius = function () {
  return this.property().actualRadius();
};

Label.prototype.draw = function (container) {
  return this.property().draw(container);
};

Label.prototype.inverse = function () {
  return this.property().inverse();
};

Label.prototype.equals = function (other) {
  if (!other) {
    return false;
  }

  const instance = other instanceof Label;
  const equalProperty = this.property().equals(other.property());

  let equalInverse = false;
  if (this.inverse()) {
    equalInverse = this.inverse().equals(other.inverse());
  } else if (!other.inverse()) {
    equalInverse = true;
  }

  return instance && equalProperty && equalInverse;
};
