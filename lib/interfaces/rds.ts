import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';

export interface IRdsNetworkConfig {
  vpc: ec2.IVpc;
}

export interface IRdsIngressSource {
  securityGroup: ec2.ISecurityGroup;
  portRules: IRdsPortRule[];
}

export interface IRdsPortRule {
  port: ec2.Port;
  description: string;
}

export interface IRdsClusterConfig {
  id: string;
  name: string;
  databaseName: string;
  deletionProtection: boolean;
  capacity?: { min: number; max: number };
  readers?: cdk.aws_rds.IClusterInstance[];
  admin: { username: string; secretName: string };
}

export interface IRdsAppUserConfig {
  username: string;
  secretName: string;
}

export interface RdsProps {
  network: IRdsNetworkConfig;
  ingressSources: IRdsIngressSource[]; 
  cluster: IRdsClusterConfig;
  appUser: IRdsAppUserConfig;
}

export interface RdsSecurityGroupProps {
  vpc: ec2.IVpc;
  ingressSources: IRdsIngressSource[];
}

export interface RdsClusterProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  clusterConfig: IRdsClusterConfig;
}
