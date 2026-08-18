const createOwlapiDevelopmentRoute = require("./owlapiDevelopmentRoute");

module.exports = function installOwlapiDevelopmentIntegration({
  application,
  target,
}) {
  if (!application || typeof application.getOptions !== "function") {
    throw new TypeError("application must expose getOptions()");
  }
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError("target must be an object");
  }

  target.owlapiDevelopment = createOwlapiDevelopmentRoute({
    publish(result) {
      const loadingModule = application.getOptions().loadingModule();
      loadingModule.directInput(JSON.stringify(result));
    },
  });
  if (target.document?.documentElement?.dataset) {
    target.document.documentElement.dataset.owlapiDevelopment = "available";
  }
  return target.owlapiDevelopment;
};
