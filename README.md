# Harness FME Feature Flag Transformation Lambda

This AWS Lambda function transforms Harness FME feature flag change events into a standardized deployment format for FME and sends the result to a SEI endpoint via HTTP POST.

## Overview

The Lambda function takes a JSON payload from a [Harness FME Audit webhook](https://help.split.io/hc/en-us/articles/360020957991-Webhook-audit-log) containing information about feature flag changes, transforms it into a standardized format for deployment tracking, and sends it to a SEI endpoint.

## Input Format

The function expects a JSON input in the following format:

```json
{
  "name": "feature-name",
  "type": "Split",
  "changeNumber": 1234567890123,
  "time": 1234567890123,
  "definition": "...",
  "description": "...",
  "link": "https://app.split.io/...",
  "title": "",
  "environmentName": "Prod-Default",
  "environmentId": "...",
  "editor": "user.name",
  "schemaVersion": 1,
  "previous": {
    ...
  }
}
```

## Output Format

The function transforms the input into the following format and sends it to the configured endpoint:

```json
{
  "pipeline": "FME",
  "job_full_name": "FME",
  "qualified_name": "FME",
  "instance_name": "FME",
  "instance_guid": "001101011",
  "start_time": 1234567890123,
  "duration": 0,
  "result": "SUCCESS",
  "user_id": "user.name",
  "build_number": 1234567890123,
  "branch_name": "Prod-Default",
  "module_name": "feature-name",
  "web_url": "https://app.split.io/...",
  "job_run": "..."
}
```

## Configuration

This integration will be treated in Harness SEI as a [Custom CICD Integration](https://developer.harness.io/docs/software-engineering-insights/setup-sei/configure-integrations/custom-cicd/sei-custom-cicd-integration/)

The function requires the following environment variables:

- `TARGET_ENDPOINT`: The URL of the endpoint to which the transformed data will be sent (e.g., the CICD url in your SEI instance)
- `AUTH_TOKEN`: An authorization token to include in requests to the SEI endpoint - this is your SEI API Key
- `INSTANCE_GUID`: A unique identifier for the instance that will be included in the transformed output data (e.g., you send a CURL request to `https://app.harness.io/prod1/sei/api/v1/cicd/instances` as described in the [SEI documentation](https://developer.harness.io/docs/software-engineering-insights/setup-sei/configure-integrations/custom-cicd/sei-custom-cicd-integration/#step-2-generate-a-cicd-instance-guid-associated-with-that-integration) and you will receive a response with an `id` that is the instance guid)

## Usage



### AWS Lambda Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Zip the contents of this directory:
   ```bash
   zip -r function.zip .
   ```

3. Deploy to AWS Lambda:
   ```bash
   aws lambda create-function \
     --function-name split-io-transformation \
     --runtime nodejs18.x \
     --handler index.handler \
     --zip-file fileb://function.zip \
     --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
     --environment Variables={\
TARGET_ENDPOINT=https://your-endpoint.com/api/webhook,\
AUTH_TOKEN=your-auth-token,\
INSTANCE_GUID=your-instance-guid}
   ```

4. Or update an existing function:
   ```bash
   aws lambda update-function-code \
     --function-name split-io-transformation \
     --zip-file fileb://function.zip
   ```

5. Update environment variables for an existing function:
   ```bash
   aws lambda update-function-configuration \
     --function-name split-io-transformation \
     --environment Variables={\
TARGET_ENDPOINT=https://your-endpoint.com/api/webhook,\
AUTH_TOKEN=your-auth-token,\
INSTANCE_GUID=your-instance-guid}
   ```

## Setting Up with Harness FME


To set up a new or different configuration:

1. Create an API Gateway trigger for your Lambda function
2. Configure Harness FME to send webhook events to your API Gateway URL
3. Ensure your Lambda function has the necessary permissions to make outbound HTTP requests

## Error Handling

The Lambda function includes error handling for:
- Missing environment variables
- Failed HTTP requests to the target endpoint
- Invalid input data

Errors are logged to CloudWatch Logs for troubleshooting.
