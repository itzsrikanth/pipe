const MongoClient = require('mongodb').MongoClient;
const Twitter = require('twitter');
const keys = require('./utils/keys');
const hits = require('./utils/hits');

require('dotenv').config();
keys([
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'ACCESS_TOKEN_KEY',
    'ACCESS_TOKEN_SECRET',
    'BEARER_TOKEN',
    'Q'
]);

const T = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});
const connectionString = 'mongodb://localhost:27017?authSource=admin'
const dbName = 'trends';
const collecName = 'tweets';
const MAX_COUNT = 100;

MongoClient.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, async (err, client) => {
    if (err) {
        throw err;
    } else {
        const baseUrl = 'https://api.twitter.com/1.1/search/tweets.json';
        let tweets = {
            search_metadata: {
                next_results: `?q=${process.env.Q}&result_type=${process.env.MIXED_TYPE || 'mixed'}&lang=${process.env.LANG || 'en'}&include_entities=1&count=${process.env.MAX_COUNT || 100}`
            }
        };
        let dbResp, status = true;
        do {
            let lim = await hits('https://api.twitter.com/1.1/application/rate_limit_status.json?resources=search');
            if (lim[0]) {
                throw lim[0];
            } else {
                lim = lim[1].resources.search['/search/tweets'];
            }
            if (lim.remaining >= MAX_COUNT) {
                tweets = await hits(`${baseUrl}${tweets.search_metadata.next_results}&count=${process.env.MAX_COUNT || 100}`);
                if (tweets[0]) {
                    throw tweets[0];
                } else {
                    tweets = tweets[1];
                }
            } else if (lim.limits === 0) {
                const timeOut = lim.reset - Math.trunc(
                    Date.now() / 1000
                );
                tweets = await new Promise(async resolve => {
                    setTimeout(async () => {
                        resp = await hits(`${baseUrl}${tweets.search_metadata.next_results}`);
                        resolve(resp);
                    }, timeOut);
                });
                if (tweets[0]) {
                    throw tweets[0];
                } else {
                    tweets = tweets[1];
                }
            } else {
                tweets = await hits(`${baseUrl}${tweets.search_metadata.next_results}`);
                if (tweets[0]) {
                    throw tweets[0];
                } else {
                    tweets = tweets[1];
                }
            }
            console.log(`Got ${tweets.statuses.length} tweets`);
            if (tweets.statuses && tweets.statuses.length) {
                dbResp = await new Promise((resolve, reject) => {
                    client.db(dbName)
                        .collection(collecName)
                        .insertMany(tweets.statuses, (err, result) => {
                            if (err) {
                                reject([err, null]);
                            } else {
                                resolve([null, result]);
                            }
                        });
                });
                if (dbResp[0]) {
                    throw dbResp[0];
                } else {
                    console.log(`inserted ${dbResp[1].insertedCount} tweets in db`);
                    status = true;
                }
            } else {
                status = false;
            }
        } while (status);

        console.log('Starting streaming...');
        const stream = T.stream('statuses/filter', {
            track: process.env.STREAM_TRACK,
            filter_level: process.env.FILTER_LEVEL || 'none',
            language: process.env.LANG || 'en'
        });
        stream.on('data', tweet => {
            client.db(dbName)
                .collection(collecName)
                .insert(tweet, (err, result) => {
                    if (err) {
                        throw err;
                    } else {
                        console.log(
                            JSON.stringify(result)
                        );
                    }
                })
        });
        stream.on('error', err => {
            throw err;
        });
    }
});
