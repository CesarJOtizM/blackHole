module.exports = {
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
    exportsFields: ["exports"],
    importsFields: ["imports"],
    conditionNames: ["import", "module", "node", "default"],
  },
};
