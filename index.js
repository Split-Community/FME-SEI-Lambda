/**
 * AWS Lambda function to transform Split.io feature flag change events
 * into a standardized deployment format and send to a configurable endpoint
 */

const axios = require('axios');
const parseDef = require('./defparser');

exports.handler = async (event, context) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Get the required environment variables
    const targetEndpoint = process.env.TARGET_ENDPOINT;
    const authToken = process.env.AUTH_TOKEN;
    const instanceGuid = process.env.INSTANCE_GUID;
    
    // Validate all required environment variables
    if (!targetEndpoint) {
      throw new Error('TARGET_ENDPOINT environment variable is not set');
    }
    
    if (!authToken) {
      throw new Error('AUTH_TOKEN environment variable is not set');
    }
    
    if (!instanceGuid) {
      throw new Error('INSTANCE_GUID environment variable is not set');
    }
    
    // Parse the input event if it's a string
    const inputData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    

    // Transform the data into the required format
    const transformedData = {
      "pipeline": "FME", 
      "job_full_name": "FME", 
      "qualified_name": "FME", 
      "instance_name": "FME-App", 
      "instance_guid": process.env.INSTANCE_GUID, 
      "start_time": inputData.time || inputData.changeNumber, 
      "duration": 0, 
      "result": "SUCCESS", 
      "user_id": inputData.editor, 
      "build_number": inputData.changeNumber,
      "execution_id": inputData.changeNumber,
      "branch_name": inputData.environmentName, 
      "module_name": inputData.name, 
      "project_name": inputData.name,
      "job_run": parseDef.parseDef(inputData.definition),
      "repo_url": inputData.link
    };
    
    console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
    console.log(`Sending POST request to: ${targetEndpoint}`);
    
    // Send the transformed data to the target endpoint
    const response = await axios.post(targetEndpoint, transformedData, {
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `ApiKey ${process.env.AUTH_TOKEN}`
      }
    });
    
    console.log('Response from endpoint:', response.status, response.statusText);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully sent transformed data to SEI endpoint',
        targetEndpoint,
        responseStatus: response.status,
        responseStatusText: response.statusText
      })
    };
  } catch (error) {
    console.error('Error processing event or sending request:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process feature flag change event or send to SEI endpoint',
        message: error.message
      })
    };
  }
};
