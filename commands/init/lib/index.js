'use strict';

const Command = require('@xsme-cli/command')
const log = require('@xsme-cli/log')

class InitCommand extends Command {
  init () {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd.force
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  exec () {
    console.log('exec执行')
  }
}

function init (argv) {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
