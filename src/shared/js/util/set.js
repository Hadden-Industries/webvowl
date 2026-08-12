/**
 * A simple incomplete encapsulation of the d3 set, which is able to store webvowl
 * elements by using their id.
 */
module.exports = function (array) {
  const set = {},
    d3Set = new Set(array);

  set.has = function (webvowlElement) {
    return d3Set.has(webvowlElement.id());
  };

  set.add = function (webvowlElement) {
    return d3Set.add(webvowlElement.id());
  };

  set.remove = function (webvowlElement) {
    return d3Set.delete(webvowlElement.id());
  };

  set.empty = function () {
    return d3Set.size === 0;
  };

  set.size = function () {
    return d3Set.size;
  };

  return set;
};
