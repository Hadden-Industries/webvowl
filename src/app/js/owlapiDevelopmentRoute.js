module.exports = function createOwlapiDevelopmentRoute({ publish }) {
  if (typeof publish !== "function") {
    throw new TypeError("publish must be a function");
  }

  return Object.freeze({
    async load(text, options = {}) {
      const { loadWithOwlapi } =
        await import("../../owl2vowl/js/owlapiAdapter.js");
      const result = await loadWithOwlapi(text, options);
      publish(result, options.fileName);
      return result;
    },
  });
};
