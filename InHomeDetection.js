'use strict';
const express = require('express');
const reqip = require('request-ip');

const app = express();

// const inhomeDetectionConfig = {
//     connectionUrl    : "webservices.cto.tv.telus.net",
//     inHomeApiEndpoint: "/api/identity/v2/federated/users/{accountId}/is-in-home",
//     // inHomeApiEndpoint: "/api/identity/v3/users/{accountId}/is-in-home",
//     inHomeDefault    : true
// };

// CCX:
//
const inhomeDetectionConfig = {
    connectionUrl: "uat-customer-services.cogeco.com:20443",
    inHomeApiEndpoint: "/v1/ihd/users/userAccount/{accountId}/isInHome",
    inHomeDefault: false
};

let accounts = new Map()
// accounts.set('jmzhao@outlook.com',       {name: 'Jianmin Zhao', inhomeIp: ['129.192.41.146', '129.192.41.147', '73.83.147.44', '24.4.16.50']} )
// accounts.set('margkchan-mf@outlook.com', {name: 'Margaret Chan', inhomeIp: '129.192.41.169'} ) // Margaret's Samsung
// accounts.set('margkchan-uc@outlook.com', {name: 'Margaret Chan', inhomeIp: '129.192.41.169'} ) // Margaret's Samsung 
// accounts.set('alexbm_ericsson@hotmail.com', {name: 'Alex Martel', inhomeIp: '129.192.41.169'} ) // Alex Martel
// accounts.set('mf-tvx-account-321',       {name: 'Margaret Chan', inhomeIp: ['129.192.41.169']} ) // Margaret's mfn browser

accounts.set('jmzhao@outlook.com',       {name: 'Jianmin Zhao', inhomeIp: "*"} )
accounts.set('inhometest@outlook.com',   {name: 'Chaithra N.V.', inhomeIp: ['125.22.218.22', '129.192.41.146']} )
accounts.set('mkinhome@outlook.com',     {name: 'Chaithra N.V.', inhomeIp: ['125.22.218.22', '129.192.41.146']} )
accounts.set('cip.apple@outlook.com',    {name: 'Anuj Jhawar',   inhomeIp: "*"} )

// let inHomeIps = new Set(["125.22.218.22",
//                          "129.192.41.146"
//                         ]);
let inHomeIps = new Set([
    "43.249.187.215",
    "45.87.91.59",
    "49.205.222.224",
    "49.207.49.81",
    "49.37.206.195",
    "103.203.231.202",
    "103.252.25.243",
    "103.91.180.171",
    "106.51.128.126",
    "106.193.66.95",
    "112.133.248.29",
    "115.99.80.232",
    "116.66.189.242",
    "122.164.88.151",
    "122.171.168.188",
    "123.136.241.129",
    "157.45.238.233",
    "157.51.237.134",
    "157.49.74.178",
    "171.48.26.69",
    "183.82.181.5",
    "192.168.1.10",
    "192.168.43.131",
    "193.19.252.239"
]);

let inhome_path = inhomeDetectionConfig.inHomeApiEndpoint.replace(/{(.*)}/, ":$1");

app.post(inhome_path, function(req, res, next) {

    let { accountId } = req.params,
        tenantId;

    const dollar = accountId.split('$');
    if (dollar.length > 1) {
        accountId = dollar[0];
        tenantId = dollar[1];
    }

    log_request(req);

    console.log(`accountId = ${accountId}, tenantId = ${tenantId}`);
    const account = accounts.get(accountId.toLowerCase());
    
    res.header('Access-Control-Allow-Origin', '*');
    // res.header('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");

    const { localAddress: ip_localAddress, localPort: port } = req.socket
    console.log(`req.socket.localAddress ${ip_localAddress}, req.socket.localPort ${port}`);

    const forwardedIpsStr = req.header('x-forwarded-for');


    let ip = req.headers['fastly-client-ip'];
    if (!ip && forwardedIpsStr) {
        ip = forwardedIpsStr.split(/[, ]+/)[0];
    }
    console.log(`Your IP address is ${ip} and forwardIpsStr is ${forwardedIpsStr}.`)

    if (account) {
        if (checkIp(account, ip)) {
            console.log('***** inHome', ip, '*****');
            res.json({
                status: "inHome",
                ip: ip,
                reason: "account + ip",
                forward: forwardedIpsStr
            });
        } else {
            console.log('***** outOfHome', ip, '*****');
            res.json({
                status: "outOfHome",
                ip: ip,
                reason: "account + ip",
                forward: forwardedIpsStr
            });
        }
    } else if (inHomeIps.has(ip)) {
        console.log('***** inHome purely based on ip', ip, '*****');
        res.json({
            status: "inHome",
            ip: ip,
            reason: "general in-home ip",
            forward: forwardedIpsStr
        });

    } else {
        res.status(400).json({
            error: "Unknown Account or ip",
            description: `Account ${accountId} or ${ip} not found`
        });
    }
});

app.get(inhome_path, function(req, res, next) {
    res.json({
        status: "Yes, I am here."
    });
});

var cors = function(req, res, next) {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Cache-Control');
        res.send(200);
    } else {
        next();
        return;
    }
};

app.use(cors);


// Error handling
//
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json( {
        error: err.message
    } );
});

exports.handler = app;

function checkIp(account, ip) {
    let inhomeIp = account.inhomeIp;
    if (inhomeIp === '*') {
        return true;
    } else if (Array.isArray(inhomeIp)) {
        return !!inhomeIp.find(function(e) {
            return e === ip;
        });
    } else {
        return inhomeIp === ip;
    }
}

function log_request(req) {
    console.log('log request starts -----');
    if (req.headers) {
        // // Standard headers used by Amazon EC2, Heroku, and others.
        // console.log('x-client-ip', req.headers['x-client-ip']);
        
        // // Load-balancers (AWS ELB) or proxies.
        // console.log('x-forwarded-for', req.headers['x-forwarded-for']);

        // // Cloudflare.
        // // @see https://support.cloudflare.com/hc/en-us/articles/200170986-How-does-Cloudflare-handle-HTTP-Request-headers-
        // // CF-Connecting-IP - applied to every request to the origin.
        // console.log('cf-connecting-ip', req.headers['cf-connecting-ip']);

        // // Akamai and Cloudflare: True-Client-IP.
        // console.log('true-client-ip', req.headers['true-client-ip']);

        // // Default nginx proxy/fcgi; alternative to x-forwarded-for, used by some proxies.
        // if (is.ip(req.headers['x-real-ip'])) {
        //     return req.headers['x-real-ip'];
        // }

        // // (Rackspace LB and Riverbed's Stingray)
        // // http://www.rackspace.com/knowledge_center/article/controlling-access-to-linux-cloud-sites-based-on-the-client-ip-address
        // // https://splash.riverbed.com/docs/DOC-1926
        // if (is.ip(req.headers['x-cluster-client-ip'])) {
        //     return req.headers['x-cluster-client-ip'];
        // }

        // if (is.ip(req.headers['x-forwarded'])) {
        //     return req.headers['x-forwarded'];
        // }

        // if (is.ip(req.headers['forwarded-for'])) {
        //     return req.headers['forwarded-for'];
        // }

        // if (is.ip(req.headers.forwarded)) {
        //     return req.headers.forwarded;
        // }
        console.log('headers ', JSON.stringify(req.headers));
    }

    // Remote address checks.
    if (req.connection) {
        console.log('req.connection', req.connection.remoteAddress);
        if (req.connection.socket && req.connection.socket.remoteAddress) {
            console.log('connection.socket.remoteAddress', req.connection.socket.remoteAddress);
        }
    }

    if (req.socket && req.socket.remoteAddress) {
        console.log('socket.remoteAddress', req.socket.remoteAddress);
    }

    if (req.info && req.info.remoteAddress) {
        console.log('req.info', req.info.remoteAddress);
    }

    console.log('log request starts ++++++');
}
