const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
const output = document.getElementById("result");
const deadline = setTimeout(() => {
  worker.terminate();
  output.textContent = JSON.stringify({
    status: "failed",
    error: "harness-deadline",
  });
}, 60000);
worker.addEventListener("message", ({ data }) => {
  clearTimeout(deadline);
  output.textContent = JSON.stringify(
    { ...data, userAgent: navigator.userAgent },
    null,
    2,
  );
  worker.terminate();
});
worker.addEventListener("error", (event) => {
  clearTimeout(deadline);
  output.textContent = JSON.stringify({
    status: "failed",
    error: event.message,
  });
  worker.terminate();
});
fetch("./qualification-vectors.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("qualification-data-unavailable");
    }
    return response.json();
  })
  .then((vectors) => worker.postMessage(vectors))
  .catch((error) => {
    clearTimeout(deadline);
    worker.terminate();
    output.textContent = JSON.stringify({
      status: "failed",
      error: error.message,
    });
  });
