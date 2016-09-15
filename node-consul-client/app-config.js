var _ = require('lodash');
var fs = require('fs');
var linefeed = process.platform === 'win32' ? '\r\n' : '\n';
var delimiters = {};

var CONFIG_DEFAULTS = {
  includeAppJson: true,
  useEnvironmentVariables: false,
  resolveValues: false,
  resolveExternalValues: false,
  path: ['config']
};

var VARIABLE_REGEX = /\${([^}]+)}/g

setupTemplateSettings('<%', '%>');

function getAppConfig(options) {
  var finalConfig        = {},
      externalJsonConfig = {},
      profile            = null;

  options = _.extend({}, CONFIG_DEFAULTS, options);

  // check to see if the external json config
  // exists and add it to the externalJsonConfig object
  if (options.useEnvironment && process.env.APP_JSON_CONFIG) {
    try {
      externalJsonConfig = JSON.parse(process.env.APP_JSON_CONFIG);
    } catch (e) {
      // do nothing
    }
  }

  // make sure path is an array
  if (!_.isArray(options.path)) {
    options.path = [options.path];
  }

  // grab default config (app.json) from paths
  _.each(options.path, function(path) {
    // read base app config
    _.extend(finalConfig, readJsonFile(path + '/app.json'));
  });

  // run through the order of profile
  // specification to determine the final profile
  profile = options.profile || process.env.BROWSER_PROFILE || externalJsonConfig.BROWSER_PROFILE || finalConfig.BROWSER_PROFILE || 'default';

  // grab profile specific config from paths
  _.each(options.path, function(path) {
    // read the profile config
    _.extend(finalConfig, readJsonFile(path + '/app-' + profile + '.json'));
  });

  if (options.useEnvironmentVariables) {
    // overlay the external json config
    // onto the current configJson object
    _.extend(finalConfig, externalJsonConfig);

    // specific env overrides have a higher order
    // than the json environment config
    _.each(finalConfig, function(value, key) {
      if (_.has(process.env, key)) {
        finalConfig[key] = process.env[key];
      }
    });
  }

  // finally set the BROWSER_PROFILE after everything
  // has been processed
  finalConfig.BROWSER_PROFILE = profile;

  if (options.resolveValues) {
    _.each(finalConfig, function(value, key) {
      if (_.isString(value)) {
        finalConfig[key] = value.replace(VARIABLE_REGEX, function(match, name) {
          return '<%= ' + name + ' %>';
        });
      }
    });
  } else if (options.resolveExternalValues && options.imports) {
    var importNames = _.keys(options.imports || {});
    _.each(finalConfig, function(value, key) {
      if (_.isString(value)) {
        finalConfig[key] = value.replace(VARIABLE_REGEX, function(match, name) {
          var nameFirstSection = String(name).split('.')[0];
          if (_.contains(importNames, nameFirstSection)) {
            return '<%= ' + name + ' %>';
          }
          return match;
        });
      }
    });
  }

  resolveConfigValues(finalConfig, {
    data: _.extend({}, finalConfig, options.imports)
  });

  if (options.includeAppJson) {
    finalConfig.APP_JSON_CONFIG = JSON.stringify(finalConfig);
  }

  return finalConfig;
};

function readJsonFile(path) {
  var str = '';
  try {
    str = fs.readFileSync(String(path), { encoding: 'utf8' });
  } catch (e) {
    return {};
  }
  return JSON.parse(str);
};

function resolveConfigValues(config, options) {
  options = Object.create(options || {});
  _.each(config, function(value, key) {
    if (_.isString(value)) {
      config[key] = processTemplate(value, {
        data: options.data || {}
      });
    }
  });
};

function processTemplate(tmpl, options) {
  if (!options) { options = {}; }
  // Set delimiters, and get a opening match character.
  // var delimiters = template.setDelimiters(options.delimiters);
  // Clone data, initializing to config data or empty object if omitted.
  var data = Object.create(options.data || {});
  // Keep track of last change.
  var last = tmpl;
  try {
    // As long as tmpl contains template tags, render it and get the result,
    // otherwise just use the template string.
    while (tmpl.indexOf(delimiters.opener) >= 0) {
      tmpl = _.template(tmpl, data);
      // Abort if template didn't change - nothing left to process!
      if (tmpl === last) { break; }
      last = tmpl;
    }
  } catch (e) {
    // In upgrading to Lo-Dash (or Underscore.js 1.3.3), \n and \r in template
    // tags now causes an exception to be thrown. Warn the user why this is
    // happening. https://github.com/documentcloud/underscore/issues/553
    if (String(e) === 'SyntaxError: Unexpected token ILLEGAL' && /\n|\r/.test(tmpl)) {
      grunt.log.errorlns('A special character was detected in this template. ' +
        'Inside template tags, the \\n and \\r special characters must be ' +
        'escaped as \\\\n and \\\\r. (grunt 0.4.0+)');
    }
    // Slightly better error message.
    e.message = 'An error occurred while processing a template (' + e.message + ').';
    throw new Error(e);
  }
  return normalizelf(tmpl);
}

function setupTemplateSettings(opener, closer) {
  // var delimiters = {};
  // Used by grunt.
  delimiters.opener = opener;
  delimiters.closer = closer;
  // Generate RegExp patterns dynamically.
  var a = delimiters.opener.replace(/(.)/g, '\\$1');
  var b = '([\\s\\S]+?)' + delimiters.closer.replace(/(.)/g, '\\$1');
  // Used by Lo-Dash.
  delimiters.lodash = {
    evaluate: new RegExp(a + b, 'g'),
    interpolate: new RegExp(a + '=' + b, 'g'),
    escape: new RegExp(a + '-' + b, 'g')
  };
  _.templateSettings = delimiters.lodash;
}

function normalizelf(str) {
  return str.replace(/\r\n|\n/g, linefeed);
};

module.exports.get = getAppConfig;
