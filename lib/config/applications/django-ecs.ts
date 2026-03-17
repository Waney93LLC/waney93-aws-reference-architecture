// django-ecs.config.ts
// Single source of truth for the Django ECS service topology.
// AppStack stays clean; swap this file for a different service config.

import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import {
  ECS_CLUSTER_BUILDER,
  ECS_LOG_GROUP_BUILDER,
  FARGATE_SERVICE_BUILDER,
  ADOT_SIDECAR_BUILDER,
  ALB_TO_TASKS_BUILDER,
  HEALTH_CHECK_BUILDER,
  ALERTS_BUILDER,
  EcsParamConfig,
} from '../../interfaces/ecs';



export interface DjangoEcsBuilders {
  clusterBuilder: ECS_CLUSTER_BUILDER;
  logGroupBuilder: ECS_LOG_GROUP_BUILDER;
  fargateBuilder: FARGATE_SERVICE_BUILDER;
  adotBuilder: ADOT_SIDECAR_BUILDER;
  albToTasksBuilder: ALB_TO_TASKS_BUILDER;
  healthCheckBuilder: HEALTH_CHECK_BUILDER;
  alertsBuilder: ALERTS_BUILDER;
}

export function createDjangoEcsBuilders(
  scope: Construct,
  ecsConfig: EcsParamConfig,
): DjangoEcsBuilders {
  const serviceName = 'DjangoApp';

  const clusterBuilder: ECS_CLUSTER_BUILDER = {
    id: 'AppCluster',
    name: serviceName,
    
  };

  const logGroupBuilder: ECS_LOG_GROUP_BUILDER = {
    id: 'DjangoAppLogGroup',
    name: '/ecs/django-app',
    retention: cdk.aws_logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  };

  const fargateBuilder: FARGATE_SERVICE_BUILDER = {
    apiDomainCertificate: acm.Certificate.fromCertificateArn(
      scope,
      'ApiCert',
      ecsConfig.apiCertArn,
    ),

    serviceId: 'AlbFargateService',
    serviceName,

    loadBalancer: {
      public: true,
      name: 'DjangoAppALB',
    },

    task: {
      count: 1,
      cpu: 2048,
      memoryLimitMiB: 4096,
      family: 'django-task-family',
      containerName: 'web',
      imageTag: ecsConfig.imageTag,
      logStreamPrefix: 'django',
    },

    port: {
      listener: 443,
      container: 8000,
    },

    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },

    environment: {
      ENGINE: 'django.db.backends.postgresql',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
      AWS_REGION: cdk.Stack.of(scope).region,
      DJANGO_ALLOWED_HOSTS: '*',
      OTEL_SERVICE_NAME: serviceName,
    },

    appCmds: [
      'opentelemetry-instrument',
      'gunicorn',
      'djangoProject.wsgi:application',
      '--bind',
      '0.0.0.0:8000',
      '--workers',
      '2',
      '--threads',
      '2',
      '--timeout',
      '60',
      '--graceful-timeout',
      '30',
      '--keep-alive',
      '5',
      '--max-requests',
      '1000',
      '--max-requests-jitter',
      '100',
      '--access-logfile',
      '-',
      '--error-logfile',
      '-',
      '--log-level',
      'info',
    ],
  };

  const adotBuilder: ADOT_SIDECAR_BUILDER = {
    serviceId: 'AdotSidecar',
    containerName: 'adot-collector',
    image: 'public.ecr.aws/aws-observability/aws-otel-collector:v0.42.0',
    memoryReservationMiB: 256,
    command: ['--config=env:OTEL_COLLECTOR_CONFIG'],
    logStreamPrefix: 'adot',
    otelCollectorConfig: `
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 200
    spike_limit_mib: 50
  batch:

exporters:
  awsxray:

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
    path: /

service:
  extensions: [health_check]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [awsxray]
`,
    ports: {
      otlpGrpc: 4317,
      otlpHttp: 4318,
      health: 13133,
    },
    healthCheck: {
      command: ['CMD-SHELL', 'wget -qO- http://127.0.0.1:13133/ || exit 1'],
      intervalSeconds: 10,
      timeoutSeconds: 5,
      retries: 5,
      startPeriodSeconds: 30,
    },
  };

  const albToTasksBuilder: ALB_TO_TASKS_BUILDER = {
    containerPort: 8000,
    listenerPort: 443,
    albToTaskRuleDesc: 'ALB to Django tasks',
  };

  const healthCheckBuilder: HEALTH_CHECK_BUILDER = {
    path: '/healthz',
    healthyHttpCodes: '200-399',
    intervalSeconds: 30,
    timeoutSeconds: 5,
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 3,
  };

  const alertsBuilder: ALERTS_BUILDER = {
    topicId: 'EcsAlertsTopic',
    displayName: 'Django ECS Alerts',
    emailSubscriptions: [ecsConfig.alertEmailAddress],
    taskStoppedRuleId: 'EcsTaskStoppedRule',
    taskStoppedStopCodes: ['TaskFailedToStart', 'EssentialContainerExited'],
  };

  return {
    clusterBuilder,
    logGroupBuilder,
    fargateBuilder,
    adotBuilder,
    albToTasksBuilder,
    healthCheckBuilder,
    alertsBuilder,
  };
}
