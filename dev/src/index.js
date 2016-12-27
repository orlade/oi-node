var oi = require('@oi/oi');

module.exports = function (data, host, options) {
  return new oi.Module({
    command: "oi",
    describe: "Runs development actions on Oi itself",
    actions: {
      build: {
        describe: "Builds Oi from source",
        handler: () => console.log('build!!')
      }
    }
  });
};