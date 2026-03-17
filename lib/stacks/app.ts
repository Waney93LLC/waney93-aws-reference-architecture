import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcsBuilder } from '../builders/ecs-builder';
import { AppStackProps } from '../interfaces/app';
import { createDjangoSecretsBag } from '../config/applications/django-secrets-factory';
import { createDjangoEcsBuilders } from '../config/applications/django-ecs';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { config } = props;

    const secretsBag = createDjangoSecretsBag(
      this,
      config.ecsConfig.apiCertArn,
      config.cognitoConfig.appClientName,
    );

    const builders = createDjangoEcsBuilders(this, config.ecsConfig);

    new EcsBuilder(this, 'App', props)
      .withCluster(builders.clusterBuilder)
      .withLogGroup(builders.logGroupBuilder)
      .withRepo(config.ecrRepoName)
      .withSecurityGroup()
      .withServiceSecrets({ secretsBag })
      .withAlbFargateService(builders.fargateBuilder)
      .withAdotSidecar(builders.adotBuilder)
      .withXRayPermissions()
      .allowAlbToTasks(builders.albToTasksBuilder)
      .withHealthCheck(builders.healthCheckBuilder)
      .withAlerts(builders.alertsBuilder)
      .outputs();
  }
}