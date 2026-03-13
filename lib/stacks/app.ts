import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcsBuilder } from '../builders/ecs-builder';
import { SsmParameterResolver } from '../config/ssm-parameter-resolver';
import { getResourceParameterConfig, ResourceConfigFacade } from '../config/environment';
import { AppStackProps } from '../interfaces/app-layer';
import { createDjangoSecretsBag } from '../config/applications/django-secrets-factory';
import { createDjangoEcsBuilders } from '../config/applications/django-ecs';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const ecsConfig = new ResourceConfigFacade(
      new SsmParameterResolver(this),
      getResourceParameterConfig(props.stage),
    ).getEcsConfig();

    const secretsBag = createDjangoSecretsBag(this, ecsConfig);
    const builders   = createDjangoEcsBuilders(this, ecsConfig);

    new EcsBuilder(this, 'App', props)
      .withCluster(builders.clusterBuilder)
      .withLogGroup(builders.logGroupBuilder)
      .withRepo(builders.repoName)
      .withSecurityGroup()
      .withServiceSecrets({ secretsBag })
      .withAlbFargateService(builders.fargateBuilder)
      .withAdotSidecar(builders.adotBuilder)
      .withXRayPermissions()
      .allowAlbToTasks(builders.albToTasksBuilder)
      .withHealthCheck(builders.healthCheckBuilder)
      .withAlerts(builders.alertsBuilder)
      .outputs();

    cdk.Tags.of(this).add('ManagedBy', 'waney93-aws-reference-architecture');
  }
}