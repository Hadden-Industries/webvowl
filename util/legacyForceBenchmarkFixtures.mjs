import { Label } from "../src/webvowl/js/elements/links/Label.js";
import { OwlClass } from "../src/webvowl/js/elements/nodes/implementations/OwlClass.js";
import { OwlObjectProperty } from "../src/webvowl/js/elements/properties/implementations/OwlObjectProperty.js";

export const LEGACY_FORCE_FIXTURES = Object.freeze(
  [
    { id: "wvowl-medium-sparse", points: 500, links: 750, hubs: false },
    { id: "wvowl-medium-hub", points: 500, links: 1000, hubs: true },
    { id: "wvowl-large", points: 2000, links: 3000, hubs: false },
    { id: "wvowl-large-hub", points: 2000, links: 4000, hubs: true },
    { id: "wvowl-xlarge", points: 5000, links: 7500, hubs: false },
    { id: "wvowl-xlarge-dense", points: 5000, links: 15000, hubs: false },
  ].map(Object.freeze),
);

/** Independent streams let each candidate consume the same deterministic input. */
export function createForceRandom(seed = 0x5eed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Counts denote solver points/link parts, including real property-backed labels. */
export function createLegacyForceFixture(id, seed = 0x5eed) {
  const definition = LEGACY_FORCE_FIXTURES.find((fixture) => fixture.id === id);
  if (!definition) throw new RangeError(`Unknown legacy force fixture: ${id}`);
  const random = createForceRandom(seed);
  const owner = { language: () => "en" };
  const labelCount = Math.floor(definition.points / 3);
  const classCount = definition.points - labelCount;
  const classes = Array.from({ length: classCount }, (_, index) =>
    new OwlClass(owner).id(`class-${index}`),
  );
  const nodes = [...classes];
  const links = [];
  const clusterSize = Math.ceil(classCount / 8);
  const endpoint = (index) => {
    if (definition.hubs && random() < 0.7) return classes[index % 8];
    const cluster = index % 8;
    return classes[
      (cluster * clusterSize + Math.floor(random() * clusterSize)) % classCount
    ];
  };
  for (let index = 0; index < labelCount; index++) {
    const source = endpoint(index);
    let target = endpoint(index);
    if (target === source)
      target = classes[(classes.indexOf(source) + 1) % classCount];
    const property = new OwlObjectProperty(owner)
      .id(`property-${index}`)
      .domain(source)
      .range(target);
    const label = new Label(property, null);
    nodes.push(label);
    links.push({ source, target: label }, { source: label, target });
  }
  // A class chain connects every cluster; remaining links retain local/hub shape.
  for (let index = 1; index < classCount; index++) {
    links.push({ source: classes[index - 1], target: classes[index] });
  }
  while (links.length < definition.links) {
    const index = links.length;
    const source = endpoint(index);
    let target = endpoint(index);
    if (target === source)
      target = classes[(classes.indexOf(source) + 1) % classCount];
    links.push({ source, target });
  }
  nodes.forEach((node, index) => {
    const cluster = index % 8;
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 35 * Math.sqrt(Math.floor(index / 8) + 0.5);
    node.x = node.px =
      (cluster % 4) * 500 + Math.cos(angle) * radius + random();
    node.y = node.py =
      Math.floor(cluster / 4) * 500 + Math.sin(angle) * radius + random();
  });
  return { nodes, links, classCount, definition, seed };
}

/** Mirror current coefficients without replacing the numerical implementation. */
export function configureLegacyForce(
  force,
  graph,
  { theta = 0.8, chargeDistance = Infinity } = {},
) {
  return force
    .nodes(graph.nodes)
    .links(graph.links)
    .size([1600, 1000])
    .gravity(0.025)
    .charge((_, index) => (index < graph.classCount ? -500 : -400))
    .linkDistance(150)
    .linkStrength(1)
    .theta(theta)
    .chargeDistance(chargeDistance)
    .start()
    .stop();
}

export function legacyForceState(graph) {
  return graph.nodes.map((node) => [
    node.x,
    node.y,
    node.px,
    node.py,
    node.weight,
    node.index,
    Boolean(node.fixed),
  ]);
}
