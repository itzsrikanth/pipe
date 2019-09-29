module.exports = keys => {
    const obj = {};
    if (typeof keys === 'string') {
        keys = [keys];
    } else if (obj.toString.call(keys) !== '[object Array]') {
        throw new Error('Argument can be string or Array or strings');
    }
    let i;
    for(i = 0; i < keys.length; ++i) {
        if (!process.env[keys[i]]) {
            throw new Error(`Mandatory key ${keys[i]} not found`);
        }
    }
};
