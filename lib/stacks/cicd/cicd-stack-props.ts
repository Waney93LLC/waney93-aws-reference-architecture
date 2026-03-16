import * as cdk from 'aws-cdk-lib';
import { Stage } from '../../config/environment';
import { Waney93PipelineAConfig } from '../../config/pipelines/waney93';


/**
 * CICDStackProps defines the properties required to configure the CI/CD pipeline stack.
 */
export interface Waney93CICDStackProps extends cdk.StackProps {
  stage: Stage;
  config: Waney93PipelineAConfig;
}
