// The renderer stylesheet ships with the application entry. It was
// previously pulled in by the renderer package entry, which the D3 cutover
// reduced to runtime construction only.
import "../../webvowl/css/vowl.css";
import "../css/toolstyle.css";

export { createWebVowlApplication } from "./app.js";
