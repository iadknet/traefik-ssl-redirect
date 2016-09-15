var express    = require('express'),
    fs         = require('fs'),
    path       = require('path'),
    ip         = require('ip'),
    dns        = require('dns'),
    morgan     = require('morgan'),
    _          = require('underscore'),
    Handlebars = require('handlebars'),
    AppConfig  = require('./app-config'),
    ON_DEATH = require('death')
    ;

var app       = express(),
    indexFile = ''
    ;

app.use(morgan('combined'));

 try {
  // try to grab the contents of the index.html and cache them in memory
  indexFile = fs.readFileSync(path.join(__dirname, 'dist', 'index.html'), { encoding: 'utf8' });
 } catch (e) {
  console.error('There is no index.html file in the dist folder');
  process.exit(1);
 }

var appConfig = AppConfig.get({
  includeAppJson: true,
  useEnvironmentVariables: true,
  resolveValues: true,
  path: 'dist'
});

var indexFileToServe = Handlebars.compile(indexFile)(appConfig);

// for ALL routes, return the contents of the index file
app.get('*', function(req, res) {
  res.format({
    html: function() {
      res.send(indexFileToServe);
    },
    'default': function() {
      // respond with 406 since we
      // dont support anything other than html
      res.status(406).send('Not Acceptable');
    }
  });
});

var port = process.env.PORT || 8080;
app.listen(port);

// Register with consul
var consulHost = process.env.CONSUL_HOST || 'consul';
var serviceName = process.env.SERVICE_NAME || 'web-test-service'
var ethInterface = process.env.ETH_INTERFACE || 'eth0'
var appPathPrefix = appConfig.APP_PATH_PREFIX || process.env.APP_PATH_PREFIX || '/test_app'
var ipAddress = ip.address(ethInterface)
var serviceId = process.env.SERVICE_ID || serviceName + "-" + ipAddress
// have to do our own dns lookup
// consul library host resolution does not respect /etc/hosts
dns.lookup(consulHost, (err, consulIp) => {
  if (err) throw err;

  consul  = require('consul')({'host': consulHost});

  consul.agent.join(consulIp, function(err) {
    if (err) throw err;
  });

  var serviceConfig = {
    "name": serviceName,
    "address": ipAddress,
    "id": serviceId,
    "port": port,
    "tags": [
      "traefik.frontend.passHostHeader=true",
      "traefik.frontend.rule=PathPrefixStrip:" + appPathPrefix
    ],
    "check": {
       "id": serviceId,
       "http": "http://" + ipAddress + ":" + port + "/",
       "interval": "10s",
       "notes": "HTTP health check for " + serviceId
    }
  }
  consul.agent.service.register(serviceConfig, function(err) {
    if (err) throw err;
  });
});

ON_DEATH(function(signal, err) {
  consul.agent.service.deregister(serviceId, function(err) {
    if (err) throw err;
  });

});

console.log('Listening on port', port);
