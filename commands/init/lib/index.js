'use strict';

const fs = require('fs')
const inquirer = require('inquirer')

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
    try {
      // 1. 准备阶段
      this.prepare()
      // 2. 下载模板
      // 3. 安装模板
    } catch (e) {
      log.error(e.message)
    }
  }

  // 准备阶段
  prepare () {
    // 1. 判断当前目录是否为空
    if (!this.isCwdEmpty()) {
      // 1.1 询问是否继续创建
    }
    // 2. 是否强制更新
    // 3. 选择项目或组件模板
    // 4. 获取项目的基本信息
  }

  isCwdEmpty () {
    const localPath = process.cwd()
    let fileList = fs.readdirSync(localPath)
    // 对一些文件进行过滤
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) === -1
    ))
    return !fileList || fileList.length <= 0
  }
}

function init (argv) {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
