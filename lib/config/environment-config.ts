/**
 * Configuration interface for the application.
 */
export interface EnvironmentConfig {
  stage: 'dev' | 'prod' | 'test';
  pipeline: {
    name: string;
    description: string;
    repository: {
      owner: string;
      name: string;
      branch: string;
    };
    codestar: {
      connectionArnParameter: string;
    };
  };
}

const CONFIG_MAP: Record<string, EnvironmentConfig> = {
  dev: {
    stage: 'dev',
    pipeline: {
      name: 'Wanye93DevPipeline',
      description: 'Pipeline for the Wanye93 development stage',
      repository: {
        owner: 'waney93',
        name: 'waney93-aws-reference-architecture',
        branch: 'dev',
      },
      codestar: {
        connectionArnParameter: 'waney93/dev/codestar/connection-arn',
      },
    },
  },
  prod: {
    stage: 'prod',
    pipeline: {
      name: 'Wanye93ProdPipeline',
      description: 'Pipeline for the Wanye93 production stage',
      repository: {
        owner: 'waney93',
        name: 'waney93-aws-reference-architecture',
        branch: 'main',
      },
      codestar: {
        connectionArnParameter: 'waney93/prod/codestar/connection-arn',
      },
    },
  },
  test: {
    stage: 'test',
    pipeline: {
      name: 'Wanye93TestPipeline',
      description: 'Pipeline for the Wanye93 test stage',
      repository: {
        owner: 'waney93',
        name: 'waney93-aws-reference-architecture',
        branch: 'test',
      },
      codestar: {
        connectionArnParameter: 'waney93/test/codestar/connection-arn',
      },
    },
  },
};

export function getConfig(
  stage: 'dev' | 'prod' | 'test',
): EnvironmentConfig | undefined {
  const config = CONFIG_MAP[stage];
  if (!config) {
    const availableStages = Object.keys(CONFIG_MAP).join(', ');
    throw new Error(
      `No config found for stage: ${stage}. Available stages are: ${availableStages}`,
    );
  }
  return config;
}
