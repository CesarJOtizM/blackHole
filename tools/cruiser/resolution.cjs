module.exports = {
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
    exportsFields: ["exports"],
    importsFields: ["imports"],
    conditionNames: ["import", "module", "node", "default"],
  },
};
