const request = require('@xsme-cli/request')

module.exports = function () {
    return request({
        url: '/project/template'
    })
}
