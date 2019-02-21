const AWS = require('aws-sdk');
const forceReload = process.env.APP_CONFIG_FORCE_RELOAD;

let configLoaded = false;
let config = {};
// Loads application configuration from SSM. Uses memoization to reduce calls to SSM.
const loadConfig = (appConfigPath, requiredParams = []) => {
  if(configLoaded && forceReload !== 'true'){
    console.log(`Config previously loaded from ${appConfigPath}`);
    return config;
  }

  const ssm = new AWS.SSM();
  const params = {
    Path: appConfigPath,
    MaxResults: 10,
    Recursive: false,
    WithDecryption: true
  };
  console.log(`Loading config from ${appConfigPath}`);
  const getParametersPromise = ssm.getParametersByPath(params).promise()
    .then(data => {
      data.Parameters.forEach((param) => {
        const paramName = param.Name.substring(param.Name.lastIndexOf("/") + 1);
        config[paramName] = param.Value;
      });
      //console.log("Parameters loaded.", config);
      requiredParams.forEach((key) => {
        if(!config.hasOwnProperty(key)) {
          configLoaded = false;
          throw new Error(`Required key ${key} was not found in ${appConfigPath}.`);
        }
      });
      console.log("Config successfully loaded.", config);
      configLoaded = true;
      return config;
    })
    .catch(e => {
      throw new Error(`Unable to load configuration: ${e.message}`);
    });
  return getParametersPromise;
}

module.exports = loadConfig;
