import * as cdk from 'aws-cdk-lib';
import { Stage } from '../../config/environment';

/**
 * CICDStackProps defines the properties required to configure the CI/CD pipeline stack.
 */
export interface CICDStackProps extends cdk.StackProps {
  stage: Stage;
}
