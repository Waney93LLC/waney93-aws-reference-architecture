import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface IBasicConfig {
  name: string;
  description: string;
  id: string;
}

export interface PortRule {
  port: ec2.Port;
  description: string;
}

export interface SecurityGroupConfig {
  portRules: PortRule[];
  definition: ec2.SecurityGroup;
}
