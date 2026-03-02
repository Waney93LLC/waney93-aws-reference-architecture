export type Stage = 'dev' | 'test' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  pipeline: {
    name: string;
    description: string;
    repository: { owner: string; name: string; branch: string };
    codestar: { connectionArnParameter: string };
  };
}

const REPO = {
  owner: 'Waney93LLC',
  name: 'waney93-aws-reference-architecture',
} as const;

// single per account (or shared) parameter
const CODESTAR_CONNECTION_ARN_PARAM = '/waney93/shared/codestar/connection-arn';

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
    pipeline: {
      name: `Wanye93${pascalStage}Pipeline`,
      description: `Pipeline for the Wanye93 ${stage} stage`,
      repository: { ...REPO, branch },
      codestar: { connectionArnParameter: CODESTAR_CONNECTION_ARN_PARAM },
    },
  };
}
