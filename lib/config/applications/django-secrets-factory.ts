// django-secrets.factory.ts

import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { ECS_PARAM_CONFIG, ServiceSecretsBag } from '../../interfaces/ecs';


const POSTGRES_KEYS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
] as const;

const POSTGRES_SECRET_FIELDS: Record<(typeof POSTGRES_KEYS)[number], string> = {
  POSTGRES_HOST: 'host',
  POSTGRES_PORT: 'port',
  POSTGRES_USER: 'username',
  POSTGRES_PASSWORD: 'password',
  POSTGRES_DB: 'dbname',
};

const COGNITO_KEYS = [
  'OIDC_RP_CLIENT_ID',
  'OIDC_RP_CLIENT_SECRET',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CUSTOM_DOMAIN',
  'COGNITO_HOSTED_UI_BASE_URL',
] as const;

export function createDjangoSecretsBag(
  scope: cdk.Stack,
  ecsConfig: ECS_PARAM_CONFIG,
): ServiceSecretsBag {
  const secretsBag: ServiceSecretsBag = {};

  const auroraSecret = secretsmanager.Secret.fromSecretNameV2(
    scope,
    'AuroraSecret',
    ecsConfig.secrets.auroraSecretName,
  );
  const oidcSecret = secretsmanager.Secret.fromSecretNameV2(
    scope,
    'OidcSecret',
    ecsConfig.secrets.oidcSecretName,
  );

  POSTGRES_KEYS.forEach((key) => {
    secretsBag[key] = ecs.Secret.fromSecretsManager(
      auroraSecret,
      POSTGRES_SECRET_FIELDS[key],
    );
  });

  COGNITO_KEYS.forEach((key) => {
    secretsBag[key] = ecs.Secret.fromSecretsManager(oidcSecret, key);
  });

  return secretsBag;
}
