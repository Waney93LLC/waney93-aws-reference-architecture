import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcsBuilder } from '../builders/ecs-builder';
import { AppStackProps } from '../interfaces/app';
import { createDjangoSecretsBag } from '../config/applications/django-secrets-factory';
import { createDjangoEcsBuilders } from '../config/applications/django-ecs';
import { getWaney93PipelineConfig } from '../config/pipelines/waney93';

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
    const pipelineConfig = getWaney93PipelineConfig(this, props.stage);

    const appClientSgId =
      pipelineConfig.baseInfrastructure.exportNames?.appClientSgId;
    const vpcId = pipelineConfig.baseInfrastructure.exportNames?.vpcId;

    new EcsBuilder(this, 'App', props)
      .withCluster(vpcId, builders.clusterBuilder)
      .withLogGroup(builders.logGroupBuilder)
      .withRepo(config.ecrRepoName)
      .withSecurityGroup(appClientSgId)
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
