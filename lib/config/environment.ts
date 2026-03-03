export type Stage = 'dev' | 'test' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  cognito?: { acmCertificateArnParameter?: string };
  pipeline: {
    name: string;
    description: string;
    repository: { owner: string; name: string; branch: string };
    codestar: { connectionArnParameter: string };
    notifications?: {
      emailParameter: string;
    };
  };
}

const REPO = {
  owner: 'Waney93LLC',
  name: 'waney93-aws-reference-architecture',
} as const;

// single per account (or shared) parameter
const CODESTAR_CONNECTION_ARN_PARAM = '/waney93/shared/codestar/connection-arn';
const NOTIFICATIONS_EMAIL_PARAM = '/waney93/shared/notifications/email';
const ACM_CERTIFICATE_ARN_PARAM = '/waney93/shared/cognito/cert-arn';

const STAGE_OVERRIDES: Record<Stage, { branch: string }> = {
  dev: { branch: 'dev' },
  test: { branch: 'test' },
  prod: { branch: 'main' },
};

export function getEnvConfig(stage: Stage): EnvironmentConfig {
  const { branch } = STAGE_OVERRIDES[stage];

  const pascalStage = stage[0].toUpperCase() + stage.slice(1);

  return {
    stage,
    cognito: { acmCertificateArnParameter: ACM_CERTIFICATE_ARN_PARAM },
    pipeline: {
      name: `Waney93${pascalStage}Pipeline`,
      description: `Pipeline for the Waney93 ${stage} stage`,
      repository: { ...REPO, branch },
      codestar: { connectionArnParameter: CODESTAR_CONNECTION_ARN_PARAM },
      notifications: { emailParameter: NOTIFICATIONS_EMAIL_PARAM },
    },
  };
}
