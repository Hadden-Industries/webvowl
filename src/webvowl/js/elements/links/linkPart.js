/**
 * A linkPart connects two force layout nodes.
 * It represents a link which can be used in the force layout.
 * @param _domain
 * @param _range
 * @param _link
 */
export function createLinkPart(_domain, _range, _link) {
  const linkPart = {},
    domain = _domain,
    link = _link,
    range = _range;

  // Define force layout properties
  Object.defineProperties(linkPart, {
    source: { value: domain, writable: true },
    target: { value: range, writable: true },
  });

  linkPart.domain = function () {
    return domain;
  };

  linkPart.link = function () {
    return link;
  };

  linkPart.range = function () {
    return range;
  };

  return linkPart;
}
