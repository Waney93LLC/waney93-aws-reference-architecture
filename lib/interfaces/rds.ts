import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { PortRule, SecurityGroupConfig } from './common';
import { IParameterResolver } from './parameter-resolver';


/**
 * An interface for configuring the properties for RdsStack
 */
export interface RdsConstructProps extends cdk.StackProps {
  secGrpConfigs: SecurityGroupConfig[];
  clusterConfig: {
    deletionProtection: boolean;
    name: string;
    id: string;
    databaseName: string;
    admin: {
      username: string;
      secretName: string;
    };
    app: {
      secretName: string;
      username: string;
    };
    capacity?: {
      min: number;
      max: number;
    };
    readers?: cdk.aws_rds.IClusterInstance[];
  };
}

/**
 * An interface for configuring the properties for RdsConfig
 */
export interface RdsConfig {
  portRules: PortRule[];
  parameterResolver: IParameterResolver;
  deletionProtection: boolean;
  capacity?: {
    min: number;
    max: number;
  };
  readers?: cdk.aws_rds.IClusterInstance[];
  name: string;
  id: string;
  databaseName: string;
}
