import "../css/vowl.css";

const nodeMap = require("./elements/nodes/nodeMap")();
const propertyMap = require("./elements/properties/propertyMap")();

const webvowl = {};
webvowl.graph = require("./graph");
webvowl.options = require("../../shared/js/options");
webvowl.version = "@@WEBVOWL_VERSION";

webvowl.util = {};
webvowl.util.constants = require("../../shared/js/util/constants");
webvowl.util.languageTools = require("../../shared/js/util/languageTools");
webvowl.util.elementTools = require("../../shared/js/util/elementTools");
webvowl.util.prefixTools = require("../../shared/js/util/prefixRepresentationModule");
webvowl.modules = {};
webvowl.modules.colorExternalsSwitch = require("../../shared/js/modules/colorExternalsSwitch");
webvowl.modules.compactNotationSwitch = require("../../shared/js/modules/compactNotationSwitch");
webvowl.modules.datatypeFilter = require("../../shared/js/modules/datatypeFilter");
webvowl.modules.disjointFilter = require("../../shared/js/modules/disjointFilter");
webvowl.modules.focuser = require("../../shared/js/modules/focuser");
webvowl.modules.emptyLiteralFilter = require("../../shared/js/modules/emptyLiteralFilter");
webvowl.modules.nodeDegreeFilter = require("../../shared/js/modules/nodeDegreeFilter");
webvowl.modules.nodeScalingSwitch = require("../../shared/js/modules/nodeScalingSwitch");
webvowl.modules.objectPropertyFilter = require("../../shared/js/modules/objectPropertyFilter");
webvowl.modules.pickAndPin = require("../../shared/js/modules/pickAndPin");
webvowl.modules.selectionDetailsDisplayer = require("../../shared/js/modules/selectionDetailsDisplayer");
webvowl.modules.setOperatorFilter = require("../../shared/js/modules/setOperatorFilter");
webvowl.modules.statistics = require("../../shared/js/modules/statistics");
webvowl.modules.subclassFilter = require("../../shared/js/modules/subclassFilter");

webvowl.nodes = {};
nodeMap.forEach(function (value, key) {
  mapEntryToIdentifier(webvowl.nodes, key, value);
});

webvowl.properties = {};
propertyMap.forEach(function (value, key) {
  mapEntryToIdentifier(webvowl.properties, key, value);
});

function mapEntryToIdentifier(map, key, value) {
  const identifier = key.replace(":", "").toLowerCase();
  map[identifier] = value;
}

module.exports = webvowl;
