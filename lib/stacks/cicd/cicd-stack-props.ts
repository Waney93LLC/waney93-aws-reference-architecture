import * as cdk from 'aws-cdk-lib';
import { Stage } from '../../config/environment';


/**
 * Waney93CICDStackProps defines the properties required to configure the CI/CD pipeline stack.
 */
export interface Waney93CICDStackProps extends cdk.StackProps {
  stage: Stage;
}
