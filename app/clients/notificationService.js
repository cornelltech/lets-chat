var request = require('request');
var settings = require('../config');

function sendNotification(uids, text, callback) {

    var url = process.env.LUMBR_NOTIFICATION_URL + '/push';
    var token = process.env.LETS_CHAT_SERVER_TOKEN;

    var data = {
      uids: uids,
      notification: {
        alert: text
      }
    };

    // console.log('sending a message');

    request({
      method: 'POST',
      url: url,
      body: data,
      json: true
    }, function (error, response, body) {
        if (error) {
          return callback(error, null);
        }

        if(response.statusCode < 400){
        return callback(null, body);
        } else {
          console.log('error: '+ response.statusCode)
          console.log(body)
          return callback(error, null);
        }
      }).auth(null, null, true, token);

};

module.exports = {
    sendNotification: sendNotification
};
