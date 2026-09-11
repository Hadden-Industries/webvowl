import { createRenderedDrawingSnapshot } from "./renderedDrawingSnapshot.js";

function textColorOption(color) {
  return color === "rgb(0, 0, 0)"
    ? ", text=black"
    : color === "rgb(255, 255, 255)"
      ? ", text=white"
      : "";
}

function escapeTexText(text) {
  const escapes = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    $: "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    _: "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return String(text).replace(
    /[\\{}$&#%_~^]/gu,
    (character) => escapes[character],
  );
}

function serializeTextLines(element, isNode = false) {
  if (element.textLines.length === 0) {
    return escapeTexText(element.label);
  }
  return element.textLines
    .map((text, index) => {
      const escaped = escapeTexText(text);
      if (
        isNode &&
        element.individualCount > 0 &&
        element.individualCount === Number.parseInt(text, 10)
      ) {
        return `{\\color{gray} ${escaped} }`;
      }
      if (index > 0 && (isNode || text.includes("("))) {
        return `{\\small ${escaped} }`;
      }
      return escaped;
    })
    .join("\\\\ ");
}

export function serializeRenderedDrawingAsTikz(snapshot) {
  const { bounds, nodes, propertyLabels, links, compactNotation } =
    createRenderedDrawingSnapshot(snapshot);
  for (const element of [
    ...nodes,
    ...propertyLabels.flatMap((label) => [
      label,
      ...(label.inverse === null ? [] : [label.inverse]),
    ]),
  ]) {
    if (
      element.backgroundColor !== null &&
      !/^#[a-f0-9]{6}$/iu.test(element.backgroundColor)
    ) {
      throw new TypeError("A drawing color must use six hexadecimal digits.");
    }
  }
  const bbox = [bounds.leftPx, -bounds.bottomPx, bounds.rightPx, -bounds.topPx];
  let comment =
    " %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n";
  comment +=
    " %        Generated with the experimental LaTeX exporter of WebVOWL %%% \n";
  comment +=
    " %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n\n";
  comment +=
    " %   The content can be used as import in other TeX documents. \n";
  comment += " %   Parent document has to use the following packages   \n";
  comment += " %   \\usepackage{tikz}  \n";
  comment += " %   \\usepackage{helvet,graphicx}  \n";
  comment +=
    " %   \\usetikzlibrary{decorations.markings,decorations.shapes,decorations,arrows,automata,backgrounds,petri,shapes.geometric}  \n";
  comment += " %   \\usepackage{xcolor}  \n\n";
  comment +=
    " %%%%%%%%%%%%%%% Example Parent Document %%%%%%%%%%%%%%%%%%%%%%%\n";
  comment += " %\\documentclass{article} \n";
  comment += " %\\usepackage{tikz} \n";
  comment += " %\\usepackage{helvet,graphicx} \n";
  comment +=
    " %\\usetikzlibrary{decorations.markings,decorations.shapes,decorations,arrows,automata,backgrounds,petri,shapes.geometric} \n";
  comment += " %\\usepackage{xcolor} \n\n";
  comment += " %\\begin{document} \n";
  comment += " %\\section{Example} \n";
  comment += " %  This is an example. \n";
  comment += " %  \\begin{figure} \n";
  comment +=
    " %    \\input{<THIS_FILE_NAME>} % << tex file name for the graph \n";
  comment += " %    \\caption{A WebVOWL drawing exported as TikZ } \n";
  comment += " %  \\end{figure} \n";
  comment += " %\\end{document} \n";
  comment +=
    " %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n\n";

  let texString =
    comment +
    "\\definecolor{imageBGCOLOR}{HTML}{FFFFFF} \n" +
    "\\definecolor{owlClassColor}{HTML}{AACCFF}\n" +
    "\\definecolor{owlObjectPropertyColor}{HTML}{AACCFF}\n" +
    "\\definecolor{owlExternalClassColor}{HTML}{AACCFF}\n" +
    "\\definecolor{owlDatatypePropertyColor}{HTML}{99CC66}\n" +
    "\\definecolor{owlDatatypeColor}{HTML}{FFCC33}\n" +
    "\\definecolor{owlThingColor}{HTML}{FFFFFF}\n" +
    "\\definecolor{valuesFrom}{HTML}{6699CC}\n" +
    "\\definecolor{rdfPropertyColor}{HTML}{CC99CC}\n" +
    "\\definecolor{unionColor}{HTML}{6699cc}\n" +
    "\\begin{center} \n" +
    "\\resizebox{\\linewidth}{!}{\n" +
    "\\begin{tikzpicture}[framed]\n" +
    "\\clip (" +
    bbox[0] +
    "pt , " +
    bbox[1] +
    "pt ) rectangle (" +
    bbox[2] +
    "pt , " +
    bbox[3] +
    "pt);\n" +
    "\\tikzstyle{dashed}=[dash pattern=on 4pt off 4pt] \n" +
    "\\tikzstyle{dotted}=[dash pattern=on 2pt off 2pt] \n" +
    "\\sffamily\\fontsize{12}{12}\\selectfont\n \n";

  texString +=
    "\\tikzset{triangleBlack/.style = {fill=black, draw=black, line width=1pt,scale=0.7,regular polygon, regular polygon sides=3} }\n";
  texString +=
    "\\tikzset{triangleWhite/.style = {fill=white, draw=black, line width=1pt,scale=0.7,regular polygon, regular polygon sides=3} }\n";
  texString +=
    "\\tikzset{triangleBlue/.style  = {fill=valuesFrom, draw=valuesFrom, line width=1pt,scale=0.7,regular polygon, regular polygon sides=3} }\n";

  texString +=
    "\\tikzset{Diamond/.style = {fill=white, draw=black, line width=2pt,scale=1.2,regular polygon, regular polygon sides=4} }\n";

  texString +=
    "\\tikzset{Literal/.style={rectangle,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, draw=black, dashed, line width=1pt, fill=owlDatatypeColor, minimum width=80pt,\n" +
    "minimum height = 20pt}}\n\n";

  texString +=
    "\\tikzset{Datatype/.style={rectangle,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, draw=black, line width=1pt, fill=owlDatatypeColor, minimum width=80pt,\n" +
    "minimum height = 20pt}}\n\n";

  texString +=
    "\\tikzset{owlClass/.style={circle, inner sep=0mm,align=center, \n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, draw=black, line width=1pt, fill=owlClassColor, minimum size=101pt}}\n\n";

  texString +=
    "\\tikzset{anonymousClass/.style={circle, inner sep=0mm,align=center, \n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, dashed, draw=black, line width=1pt, fill=owlClassColor, minimum size=101pt}}\n\n";

  texString +=
    "\\tikzset{owlThing/.style={circle, inner sep=0mm,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, dashed, draw=black, line width=1pt, fill=owlThingColor, minimum size=62pt}}\n\n";

  texString +=
    "\\tikzset{owlObjectProperty/.style={rectangle,align=center,\n" +
    "inner sep=0mm,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "fill=owlObjectPropertyColor, minimum width=80pt,\n" +
    "minimum height = 25pt}}\n\n";

  texString +=
    "\\tikzset{rdfProperty/.style={rectangle,align=center,\n" +
    "inner sep=0mm,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "fill=rdfPropertyColor, minimum width=80pt,\n" +
    "minimum height = 25pt}}\n\n";

  texString +=
    "\\tikzset{owlDatatypeProperty/.style={rectangle,align=center,\n" +
    "fill=owlDatatypePropertyColor, minimum width=80pt,\n" +
    "inner sep=0mm,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "minimum height = 25pt}}\n\n";

  texString +=
    "\\tikzset{rdfsSubClassOf/.style={rectangle,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "inner sep=0mm,\n" +
    "fill=imageBGCOLOR, minimum width=80pt,\n" +
    "minimum height = 25pt}}\n\n";

  texString +=
    "\\tikzset{unionOf/.style={circle, inner sep=0mm,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, draw=black, line width=1pt, fill=unionColor, minimum size=25pt}}\n\n";

  texString +=
    "\\tikzset{disjointWith/.style={circle, inner sep=0mm,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "black, draw=black, line width=1pt, fill=unionColor, minimum size=20pt}}\n\n";

  texString +=
    "\\tikzset{owlEquivalentClass/.style={circle,align=center,\n" +
    "font={\\fontsize{12pt}{12}\\selectfont \\sffamily },\n" +
    "inner sep=0mm,\n" +
    "black, solid, draw=black, line width=3pt, fill=owlExternalClassColor, minimum size=101pt,\n" +
    "postaction = {draw,line width=1pt, white}}}\n\n";

  let i = 0;
  // export only nodes;
  // draw Links;
  for (i = 0; i < links.length; i++) {
    const link = links[i];
    // console.warn("\n****************\nInverstigating Link for property "+link.property().labelForCurrentLanguage());

    const prop = link;
    let rx, ry;
    let colorStr = "black";
    let linkStyle = "";
    let isLoop = "";
    let len;
    let ahAngle;

    let arrowType = "triangleBlack";
    const linkWidth = ",line width=2pt";
    if (prop.linkType) {
      if (prop.linkType === "dotted") {
        //stroke-dasharray: 3;
        linkStyle = ", dotted ";
        arrowType = "triangleWhite";
      }
      if (prop.linkType === "dashed") {
        //stroke-dasharray: 3;
        linkStyle = ", dashed ";
      }

      if (prop.linkType === "values-from") {
        colorStr = "valuesFrom";
      }
    }

    let startX, startY, endX, endY, normX, normY;

    const [start, middle, end] = link.points;
    const dx = start.x,
      dy = -start.y,
      px = middle.x,
      py = -middle.y;
    rx = end.x;
    ry = -end.y;
    if (link.isLoop) {
      isLoop = ", tension=3";
    }

    texString +=
      "\\draw [" +
      colorStr +
      linkStyle +
      linkWidth +
      isLoop +
      "] plot [smooth] coordinates {(" +
      dx +
      "pt, " +
      dy +
      "pt) (" +
      px +
      "pt, " +
      py +
      "pt)  (" +
      rx +
      "pt, " +
      ry +
      "pt)};\n";

    if (link.marker === null) {
      continue;
    }

    // add arrow head;

    if (
      link.vowlType === "owl:someValuesFrom" ||
      link.vowlType === "owl:allValuesFrom"
    ) {
      arrowType = "triangleBlue";
    }

    const { start: p1, end: p2, center: markerCenter } = link.marker;
    if (link.vowlType === "setOperatorProperty") {
      arrowType = "Diamond";
    }
    startX = p1.x;
    startY = p1.y;
    endX = p2.x;
    endY = p2.y;
    normX = endX - startX;
    normY = endY - startY;
    len = Math.hypot(normX, normY) || 1;
    normX = normX / len;
    normY = normY / len;

    ahAngle = -1.0 * Math.atan2(normY, normX) * (180 / Math.PI);
    ahAngle -= 90;
    if (link.vowlType === "setOperatorProperty") {
      ahAngle -= 45;
    }
    // console.warn(link.property().labelForCurrentLanguage()+ ": "+normX+ " "+normY +"  "+ahAngle);
    rx = markerCenter.x;
    ry = markerCenter.y;
    if (link.isSingle) {
      // markerOffset=-1*m
      ry = -1 * ry;
      texString +=
        "\\node[" +
        arrowType +
        ", rotate=" +
        ahAngle +
        "] at (" +
        rx +
        "pt, " +
        ry +
        "pt)   (single_marker" +
        i +
        ") {};\n ";
    } else {
      ry = -1 * ry;
      texString +=
        "\\node[" +
        arrowType +
        ", rotate=" +
        ahAngle +
        "] at (" +
        rx +
        "pt, " +
        ry +
        "pt)   (marker" +
        i +
        ") {};\n ";
    }

    // if   (link.isLoop){
    //    rotAngle=-10+angle * (180 / Math.PI);
    // }

    // add cardinality;
    let cardinalityText = escapeTexText(link.cardinalityText);
    if (cardinalityText && cardinalityText.length > 0) {
      const cardinalityCenter = link.marker.cardinalityCenter;
      const cx = cardinalityCenter.x - 10 * normY;
      let cy = cardinalityCenter.y + 10 * normX; // using orthonormal y Coordinate
      cy *= -1.0;
      const textColor = "black";
      if (link.cardinalityText === "A") {
        cardinalityText = "$\\forall$";
      }
      if (link.cardinalityText === "E") {
        cardinalityText = "$\\exists$";
      }

      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily },text=" +
        textColor +
        "] at (" +
        cx +
        "pt, " +
        cy +
        "pt)   (cardinalityText" +
        i +
        ") {" +
        cardinalityText +
        "};\n ";
    }

    if (link.inverseMarker !== null) {
      const {
        start: p1_inv,
        end: p2_inv,
        center: markerCenter_inv,
      } = link.inverseMarker;
      startX = p1_inv.x;
      startY = p1_inv.y;
      endX = p2_inv.x;
      endY = p2_inv.y;
      normX = endX - startX;
      normY = endY - startY;
      len = Math.hypot(normX, normY) || 1;
      normX = normX / len;
      normY = normY / len;

      ahAngle = -1.0 * Math.atan2(normY, normX) * (180 / Math.PI);
      ahAngle -= 90;
      //   console.warn("INV>>\n "+link.property().inverse().labelForCurrentLanguage()+ ": "+normX+ " "+normY +"  "+ahAngle);
      rx = markerCenter_inv.x;
      ry = markerCenter_inv.y;
      if (link.isSingle) {
        // markerOffset=-1*m
        ry = -1 * ry;
        texString +=
          "\\node[" +
          arrowType +
          ", rotate=" +
          ahAngle +
          "] at (" +
          rx +
          "pt, " +
          ry +
          "pt)   (INV_single_marker" +
          i +
          ") {};\n ";
      } else {
        ry = -1 * ry;
        texString +=
          "\\node[" +
          arrowType +
          ", rotate=" +
          ahAngle +
          "] at (" +
          rx +
          "pt, " +
          ry +
          "pt)   (INV_marker" +
          i +
          ") {};\n ";
      }
    }
  }

  nodes.forEach(function (node) {
    const px = node.x;
    const py = -node.y;
    let qType = "owlClass";
    if (node.vowlType === "owl:Thing" || node.vowlType === "owl:Nothing") {
      qType = "owlThing";
    }

    if (node.vowlType === "owl:equivalentClass") {
      qType = "owlEquivalentClass";
    }
    const textColorStr = textColorOption(node.textColor);
    const identifier = serializeTextLines(node, true);
    if (node.vowlType === "rdfs:Literal") {
      qType = "Literal";
    }
    if (node.vowlType === "rdfs:Datatype") {
      qType = "Datatype";
    }
    if (node.attributes.indexOf("anonymous") !== -1) {
      qType = "anonymousClass";
    }

    if (
      node.vowlType === "owl:unionOf" ||
      node.vowlType === "owl:complementOf" ||
      node.vowlType === "owl:disjointUnionOf" ||
      node.vowlType === "owl:intersectionOf"
    ) {
      qType = "owlClass";
    }

    let bgColorStr = "";
    let widthString;

    if (node.vowlType === "rdfs:Literal" || node.vowlType === "rdfs:Datatype") {
      const width = node.widthPx;
      widthString = ",minimum width=" + width + "pt";
    } else {
      widthString = ",minimum size=" + node.widthPx + "pt";
    }
    if (node.backgroundColor) {
      let bgColor = node.backgroundColor;
      bgColor.toUpperCase();
      bgColor = bgColor.slice(1, bgColor.length);
      texString +=
        "\\definecolor{Node" + i + "_COLOR}{HTML}{" + bgColor + "} \n ";
      bgColorStr = ", fill=Node" + i + "_COLOR ";
    }
    if (node.attributes.indexOf("deprecated") > -1) {
      texString += "\\definecolor{Node" + i + "_COLOR}{HTML}{CCCCCC} \n ";
      bgColorStr = ", fill=Node" + i + "_COLOR ";
    }

    const leftPos = px - 7;
    const rightPos = px + 7;
    const txtOffset = py + 20;
    if (
      ![
        "owl:unionOf",
        "owl:disjointUnionOf",
        "owl:complementOf",
        "owl:intersectionOf",
      ].includes(node.vowlType)
    ) {
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)   (Node" +
        i +
        ") {" +
        identifier +
        "};\n";
    }
    if (node.vowlType === "owl:unionOf") {
      // add symbol to it;
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)   (Node" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        rightPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf ,fill=none   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[text=black] at (" +
        px +
        "pt, " +
        py +
        "pt)  (unionText13) {$\\mathbf{\\cup}$};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        txtOffset +
        "pt)   (Node_text" +
        i +
        ") {" +
        identifier +
        "};\n";
    }
    // OWL DISJOINT UNION OF
    if (node.vowlType === "owl:disjointUnionOf") {
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)   (Node" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        rightPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf ,fill=none   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)  (disjointUnoinText" +
        i +
        ") {1};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        txtOffset +
        "pt)   (Node_text" +
        i +
        ") {" +
        identifier +
        "};\n";
    }
    // OWL COMPLEMENT OF
    if (node.vowlType === "owl:complementOf") {
      // add symbol to it;
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)   (Node" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        px +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[font={\\fontsize{18pt}{18}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)  (unionText13) {$\\neg$};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        txtOffset +
        "pt)   (Node_text" +
        i +
        ") {" +
        identifier +
        "};\n";
    }
    // OWL INTERSECTION OF
    if (node.vowlType === "owl:intersectionOf") {
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)   (Node" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf   , text=black] at (" +
        rightPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[unionOf ,fill=none   , text=black] at (" +
        leftPos +
        "pt, " +
        py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";

      // add now the outer colors;
      texString +=
        "\\filldraw[even odd rule,fill=owlClassColor,line width=1pt] (" +
        leftPos +
        "pt, " +
        py +
        "pt) circle (12.5pt)  (" +
        rightPos +
        "pt, " +
        py +
        "pt) circle (12.5pt);\n ";

      // add texts
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        py +
        "pt)  (intersectionText" +
        i +
        ") {$\\cap$};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        px +
        "pt, " +
        txtOffset +
        "pt)   (Node_text" +
        i +
        ") {" +
        identifier +
        "};\n";
    }

    i++;
  });
  for (i = 0; i < propertyLabels.length; i++) {
    const correspondingProp = propertyLabels[i];
    const p_px = propertyLabels[i].x;
    const p_py = -propertyLabels[i].y;
    const textColorStr = textColorOption(correspondingProp.textColor);
    const identifier = serializeTextLines(correspondingProp);
    if (correspondingProp.vowlType === "setOperatorProperty") {
      continue; // this property does not have a label
    }
    let qType = "owlObjectProperty";
    if (correspondingProp.vowlType === "owl:DatatypeProperty") {
      qType = "owlDatatypeProperty";
    }
    if (correspondingProp.vowlType === "rdfs:subClassOf") {
      qType = "rdfsSubClassOf";
    }
    if (correspondingProp.vowlType === "rdf:Property") {
      qType = "rdfProperty";
    }

    let bgColorStr = "";
    if (correspondingProp.backgroundColor) {
      // console.warn("Found backGround color");
      let bgColor = correspondingProp.backgroundColor;
      //console.warn(bgColor);
      bgColor.toUpperCase();
      bgColor = bgColor.slice(1, bgColor.length);
      texString +=
        "\\definecolor{property" + i + "_COLOR}{HTML}{" + bgColor + "} \n ";
      bgColorStr = ", fill=property" + i + "_COLOR ";
    }
    if (correspondingProp.attributes.indexOf("deprecated") > -1) {
      texString += "\\definecolor{property" + i + "_COLOR}{HTML}{CCCCCC} \n ";
      bgColorStr = ", fill=property" + i + "_COLOR ";
    }

    const width = correspondingProp.widthPx;
    const widthString = ",minimum width=" + width + "pt";

    // OWL INTERSECTION OF
    if (correspondingProp.vowlType === "owl:disjointWith") {
      const leftPos = p_px - 12;
      const rightPos = p_px + 12;
      const txtOffset = p_py - 20;
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        p_px +
        "pt, " +
        p_py +
        "pt)   (Node" +
        i +
        ") {};\n";
      texString +=
        "\\node[disjointWith , text=black] at (" +
        leftPos +
        "pt, " +
        p_py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[disjointWith , text=black] at (" +
        rightPos +
        "pt, " +
        p_py +
        "pt)   (SymbolNode" +
        i +
        ") {};\n";
      texString +=
        "\\node[font={\\fontsize{12pt}{12}\\selectfont \\sffamily }" +
        textColorStr +
        "] at (" +
        p_px +
        "pt, " +
        txtOffset +
        "pt)   (Node_text" +
        i +
        ") {";
      if (compactNotation === false) {
        texString += "(disjoint)";
      }
      texString += "};\n";
      continue;
    }

    if (correspondingProp.inverse) {
      const inv_correspondingProp = correspondingProp.inverse;
      // create the rendering element for the inverse property;
      const inv_textColorStr = textColorOption(inv_correspondingProp.textColor);
      const inv_identifier = serializeTextLines(inv_correspondingProp);
      const inv_qType = "owlObjectProperty";
      let inv_bgColorStr = "";

      if (inv_correspondingProp.backgroundColor) {
        //  console.warn("Found backGround color");
        let inv_bgColor = inv_correspondingProp.backgroundColor;
        //   console.warn(inv_bgColor);
        inv_bgColor.toUpperCase();
        inv_bgColor = inv_bgColor.slice(1, inv_bgColor.length);
        texString +=
          "\\definecolor{inv_property" +
          i +
          "_COLOR}{HTML}{" +
          inv_bgColor +
          "} \n ";
        inv_bgColorStr = ", fill=inv_property" + i + "_COLOR ";
      }
      if (inv_correspondingProp.attributes.indexOf("deprecated") > -1) {
        texString +=
          "\\definecolor{inv_property" + i + "_COLOR}{HTML}{CCCCCC} \n ";
        inv_bgColorStr = ", fill=inv_property" + i + "_COLOR ";
      }

      const inv_width = inv_correspondingProp.widthPx;

      const pOY1 = p_py - 14;
      const pOY2 = p_py + 14;
      const inv_widthString = ",minimum width=" + inv_width + "pt";
      texString += "% Createing Inverse Property \n";
      texString +=
        "\\node[" +
        inv_qType +
        " " +
        inv_widthString +
        " " +
        inv_bgColorStr +
        " " +
        inv_textColorStr +
        "] at (" +
        p_px +
        "pt, " +
        pOY1 +
        "pt)   (property" +
        i +
        ") {" +
        inv_identifier +
        "};\n";
      texString += "% " + inv_qType + " vs " + qType + "\n";
      texString += "% " + inv_widthString + " vs " + widthString + "\n";
      texString += "% " + inv_bgColorStr + " vs " + bgColorStr + "\n";
      texString += "% " + inv_textColorStr + " vs " + textColorStr + "\n";

      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        p_px +
        "pt, " +
        pOY2 +
        "pt)   (property" +
        i +
        ") {" +
        identifier +
        "};\n";
    } else {
      texString +=
        "\\node[" +
        qType +
        " " +
        widthString +
        " " +
        bgColorStr +
        " " +
        textColorStr +
        "] at (" +
        p_px +
        "pt, " +
        p_py +
        "pt)   (property" +
        i +
        ") {" +
        identifier +
        "};\n";
    }
  }

  texString += "\\end{tikzpicture}\n}\n \\end{center}\n";

  return texString;
}
