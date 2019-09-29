const request = require('request');

module.exports = uri => {
    return new Promise((resolve, reject) => {
        request({
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
            },
            uri,
            method: 'GET'
        }, (err, _, body) => {
            if (err) {
                reject([err, null]);
            } else {
                resolve(
                    [null, JSON.parse(body)]
                );
            }
        });
    })
};
