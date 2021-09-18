'use strict';

const log = require('npmlog')

log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info' // 消息等级设置
log.heading = 'xsme-cli' // 消息前缀
log.addLevel('success', 2000, { fg: 'green', bold: true }) // 自定义消息等级

module.exports = log
