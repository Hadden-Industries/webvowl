module.exports = Label;

/**
 * A label represents the element(s) which further describe a link.
 * It encapsulates the property and its inverse property.
 * @param property the property; the inverse is inferred
 * @param link the link this label belongs to
 */
function Label( property, link ){
  this.link = function (){
    return link;
  };
  
  this.property = function (){
    return property;
  };
  
  Object.defineProperty(this, "x", {
    get: function (){
      return property.x;
    },
    set: function ( v ){
      property.x = v;
      if ( property.inverse() ) {property.inverse().x = v;}
    }
  });
  Object.defineProperty(this, "y", {
    get: function (){
      return property.y;
    },
    set: function ( v ){
      property.y = v;
      if ( property.inverse() ) {property.inverse().y = v;}
    }
  });
  Object.defineProperty(this, "px", {
    get: function (){
      return property.px;
    },
    set: function ( v ){
      property.px = v;
      if ( property.inverse() ) {property.inverse().px = v;}
    }
  });
  Object.defineProperty(this, "py", {
    get: function (){
      return property.py;
    },
    set: function ( v ){
      property.py = v;
      if ( property.inverse() ) {property.inverse().py = v;}
    }
  });
  // "Forward" the fixed value set on the property to avoid having to access this container
  Object.defineProperty(this, "fixed", {
    get: function (){
      const inverseFixed = property.inverse() ? property.inverse().fixed : false;
      return property.fixed || inverseFixed;
    },
    set: function ( v ){
      property.fixed = v;
      if ( property.inverse() ) {property.inverse().fixed = v;}
    }
  });
  Object.defineProperty(this, "fx", {
    get: function (){
      const inverseFx = property.inverse() ? property.inverse().fx : null;
      return property.fx !== null && property.fx !== undefined ? property.fx : inverseFx;
    },
    set: function ( v ){
      property.fx = v;
      if ( property.inverse() ) {property.inverse().fx = v;}
    }
  });
  Object.defineProperty(this, "fy", {
    get: function (){
      const inverseFy = property.inverse() ? property.inverse().fy : null;
      return property.fy !== null && property.fy !== undefined ? property.fy : inverseFy;
    },
    set: function ( v ){
      property.fy = v;
      if ( property.inverse() ) {property.inverse().fy = v;}
    }
  });
  this.frozen = property.frozen;
  this.locked = property.locked;
  this.pinned = property.pinned;
}

Label.prototype.actualRadius = function (){
  return this.property().actualRadius();
};

Label.prototype.draw = function ( container ){
  return this.property().draw(container);
};

Label.prototype.inverse = function (){
  return this.property().inverse();
};

Label.prototype.equals = function ( other ){
  if ( !other ) {
    return false;
  }
  
  const instance = other instanceof Label;
  const equalProperty = this.property().equals(other.property());
  
  let equalInverse = false;
  if ( this.inverse() ) {
    equalInverse = this.inverse().equals(other.inverse());
  } else if ( !other.inverse() ) {
    equalInverse = true;
  }
  
  return instance && equalProperty && equalInverse;
};
