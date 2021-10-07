'use strict';

const fs = require('fs')
const path = require("path");
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const userHome = require('user-home')

const Command = require('@xsme-cli/command')
const log = require('@xsme-cli/log')
const { spinnerStart, sleep } = require('@xsme-cli/utils')

const getProjectTemplate = require('./getProjectTemplate')
const Package = require("@xsme-cli/package");

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

class InitCommand extends Command {
  init () {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd.force
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  async exec () {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare()
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo)
        this.projectInfo = projectInfo
        await this.downloadTemplate()
        // 3. 安装模板
      }
    } catch (e) {
      log.error(e.message)
    }
  }

  async downloadTemplate () {
    // 1. 通过项目模版API获取项目模版信息
    // 1.1 通过egg.js搭建一套后端系统
    // 1.2 通过npm存储项目模版
    // 1.3 将项目模版信息存储到mongdb数据库中
    // 1/4 通过egg.js获取mongdb中的数据并且通过API返回
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    const targetPath = path.resolve(userHome, '.xsme-cli', 'template')
    const storeDir = path.resolve(userHome, '.xsme-cli', 'template', 'node_modules')
    const { npmName, version } = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })

    if (await templateNpm.exists()) {
      const spinner = spinnerStart('正在更新模版...')
      await sleep()
      try {
        // 更新package
        await templateNpm.update()
        log.success('模版更新成功')
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
      }
    } else {
      const spinner = spinnerStart('正在下载模版...')
      await sleep()
      try {
        // 安装package
        await templateNpm.install()
        log.success('模版下载成功')
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
      }
    }
  }

  // 准备阶段
  async prepare () {
    // 0. 判断项目模版是否存在
    const template = await getProjectTemplate()
    if (!template || template.length === 0) {
      throw new Error('项目模版不存在')
    }
    this.template = template
    // 1. 判断当前目录是否为空
    const localPath = process.cwd()
    if (!this.isDirEmpty(localPath)) {
      let ifContinue =  false
      if (!this.force) {
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？'
        })).ifContinue
        // 不再执行
        if (!ifContinue) return false
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？'
        })
        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath)
        }
      }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo () {
    let projectInfo = {}
    // 1. 选择项目或组件模板
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [{
        name: '项目',
        value: TYPE_PROJECT
      }, {
        name: '组件',
        value: TYPE_COMPONENT
      }]
    })
    log.verbose('type', type)
    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt([{
        type: 'input',
        name: 'projectName',
        message: '请输入项目名称',
        default: '',
        validate: function (v) {
          const done = this.async()
          setTimeout(function () {
            if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)) {
              done('请输入合法的项目名称:\n   1.首字符必须为英文字符\n   2.尾字符必须为英文或数字，不能为字符\n   3。字符仅允许"-_"')
              return false
            }
            done(null, true)
          }, 0)
        },
        filter: function (v) {
          return v
        }
      }, {
        type: 'input',
        name: 'projectVersion',
        message: '请输入项目版本号',
        default: '1.0.0',
        validate: function (v) {
          const done = this.async()
          setTimeout(function () {
            if (!semver.valid(v)) {
              done('请输入合法的项目版本号')
              return false
            }
            done(null, true)
          }, 0)
        },
        filter: function (v) {
          return semver.valid(v) || v
        }
      }, {
        type: 'list',
        name: 'projectTemplate',
        message: '请选择项目模版',
        choices: this.createTemplateChioces()
      }])
      projectInfo = {
        type,
        ...project
      }
    } else if (type === TYPE_COMPONENT) {}
    // 3. 返回项目基本信息
    return projectInfo
  }

  createTemplateChioces () {
    return this.template.map(template => ({
      name: template.name,
      value: template.npmName
    }))
  }

  isDirEmpty (localPath) {
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
