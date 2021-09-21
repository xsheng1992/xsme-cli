'use strict';

module.exports = init;

function init(projectName, cmdObj, command) {
  // console.log(projectName, cmdObj, command.op)
  console.log('init', projectName, cmdObj.force, process.env.CLI_TARGET_PATH)
}

module.exports = init
