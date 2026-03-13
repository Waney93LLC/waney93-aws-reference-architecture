import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';

/**
 * Configuration for Aurora cluster credential
 */
export interface ClusterCredential {}

/**
 * Configuration for ECS cluster
 */
export type ECS_CLUSTER_BUILDER = {
  id: string;
  name: string;
};  

/**
 * Configuration for ECS log group
 */
export type ECS_LOG_GROUP_BUILDER = {
  name: string;
  id: string;
  retention: cdk.aws_logs.RetentionDays;
  removalPolicy: cdk.RemovalPolicy;
};

export type FARGATE_SERVICE_BUILDER = {
  apiDomainCertificate: acm.ICertificate;
  serviceId: string;
  serviceName: string;
  loadBalancer: AlbFargateLoadBalancerConfig;
  task: AlbFargateTaskConfig;
  port: AlbFargatePortConfig;
  vpcSubnets: ec2.SubnetSelection;
};

export interface AlbFargateLoadBalancerConfig {
  public: boolean;
  name: string;
}

export interface AlbFargateTaskConfig {
  count: number;
  cpu: number;
  memoryLimitMiB: number;
}

export interface AlbFargatePortConfig {
  listener: number;
}

export interface AlbFargateConstructProps {
  /** ECS cluster to deploy into */
  cluster: ecs.ICluster;
  /** ECR repository for the container image */
  repo: ecr.IRepository;
  /** CloudWatch log group */
  logGroup: logs.ILogGroup;
  /** Security group for the Fargate service */
  serviceSg: ec2.ISecurityGroup;
  /** Secrets to inject into the task */
  secretsBag: Record<string, ecs.Secret>;
  /** Unique ID prefix for resource naming */
  idPrefix?: string;

  // --- Service identity ---
  /** Logical ID suffix for the ALB Fargate service resource */
  serviceId: string;
  /** ECS service name */
  serviceName: string;

  // --- Load balancer ---
  loadBalancer: AlbFargateLoadBalancerConfig;

  // --- Task sizing & count ---
  task: AlbFargateTaskConfig;

  // --- Networking ---
  port: AlbFargatePortConfig;
  vpcSubnets: ec2.SubnetSelection;

  // --- TLS ---
  apiDomainCertificate: acm.ICertificate;
}


export interface EcsBuilderProps {


}

export type ServiceSecretsBag = Record<string, ecs.Secret>;
export interface EcsServiceSecretsConfig {
  /**
   * Mutable bag of secrets that can be created/modified outside the builder.
   * addService() will read from here.
   */
  secretsBag?: ServiceSecretsBag;

  /**
   * Optional: which secret keys must exist before addService() can proceed.
   * Keeps addService() honest without coupling it to Secrets Manager resources.
   */
  requiredKeys?: readonly string[];
}
