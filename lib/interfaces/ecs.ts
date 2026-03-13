import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cdk from 'aws-cdk-lib';

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
