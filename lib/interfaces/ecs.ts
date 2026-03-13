import * as ecs from 'aws-cdk-lib/aws-ecs';

/**
 * Configuration for Aurora cluster credential
 */
export interface ClusterCredential {

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
