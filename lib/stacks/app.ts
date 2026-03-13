import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import {
  FARGATE_SERVICE_BUILDER,
  ADOT_SIDECAR_BUILDER,
  ALB_TO_TASKS_BUILDER,
  HEALTH_CHECK_BUILDER,
  ALERTS_BUILDER,
  ECS_CLUSTER_BUILDER,
  ECS_LOG_GROUP_BUILDER,
  ServiceSecretsBag,
} from  '../interfaces/ecs';
import { EcsBuilder } from '../builders/ecs-builder';
import { SsmParameterResolver } from '../config/ssm-parameter-resolver';
import { getResourceParameterConfig, ResourceConfigFacade } from '../config/environment';
import { AppStackProps } from '../interfaces/app-layer';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // ── Facade setup ────────────────────────────────────────────────────────

    const resolver = new SsmParameterResolver(this);
    const appPramConfig   = getResourceParameterConfig(props.stage);
    const facade = new ResourceConfigFacade(resolver, appPramConfig);
    const ecsConfig = facade.getEcsConfig();

    // ── Secrets bag ─────────────────────────────────────────────────────────

    const secretsBag = this.createSecretsBag(
      ecsConfig.secrets.auroraSecretName,
      ecsConfig.secrets.oidcSecretName,
    );

    // ── Builders ─────────────────────────────────────────────────────────────

    const clusterBuilder: ECS_CLUSTER_BUILDER = {
      id:   'AppCluster',
      name: 'DjangoApp',
    };

    const logGroupBuilder: ECS_LOG_GROUP_BUILDER = {
      id:            'DjangoAppLogGroup',
      name:          '/ecs/django-app',
      retention:     cdk.aws_logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    };

    const serviceName = 'DjangoApp';

    const fargateBuilder: FARGATE_SERVICE_BUILDER = {
      apiDomainCertificate: acm.Certificate.fromCertificateArn(
        this,
        'ApiCert',
        ecsConfig.apiCertArn,          
      ),

      serviceId:   'AlbFargateService',
       serviceName,

      loadBalancer: {
        public: true,
        name:   'DjangoAppALB',
      },

      task: {
        count:           1,
        cpu:             2048,
        memoryLimitMiB:  4096,
        family:          'django-task-family',
        containerName:   'web',
        imageTag:        ecsConfig.imageTag, 
        logStreamPrefix: 'django',
      },

      port: {
        listener:  443,
        container: 8000,
      },

      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
          ENGINE: 'django.db.backends.postgresql',
          OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
          OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
          AWS_REGION: cdk.Stack.of(this).region,
          DJANGO_ALLOWED_HOSTS: '*',
          OTEL_SERVICE_NAME: serviceName,
        },

      appCmds: [
        'opentelemetry-instrument',
        'gunicorn',
        'djangoProject.wsgi:application',
        '--bind',             '0.0.0.0:8000',
        '--workers',          '2',
        '--threads',          '2',
        '--timeout',          '60',
        '--graceful-timeout', '30',
        '--keep-alive',       '5',
        '--max-requests',     '1000',
        '--max-requests-jitter', '100',
        '--access-logfile',   '-',
        '--error-logfile',    '-',
        '--log-level',        'info',
      ],
    };

    const adotBuilder: ADOT_SIDECAR_BUILDER = {
      serviceId:           'AdotSidecar',
      containerName:       'adot-collector',
      image:               'public.ecr.aws/aws-observability/aws-otel-collector:v0.42.0',
      memoryReservationMiB: 256,
      command:             ['--config=env:OTEL_COLLECTOR_CONFIG'],
      logStreamPrefix:     'adot',
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
        health:   13133,
      },
      healthCheck: {
        command:            ['CMD-SHELL', 'wget -qO- http://127.0.0.1:13133/ || exit 1'],
        intervalSeconds:    10,
        timeoutSeconds:     5,
        retries:            5,
        startPeriodSeconds: 30,
      },
    };

    const albToTasksBuilder: ALB_TO_TASKS_BUILDER = {
      containerPort:    8000,
      listenerPort:     443,
      albToTaskRuleDesc: 'ALB to Django tasks',
    };

    const healthCheckBuilder: HEALTH_CHECK_BUILDER = {
      path:                   '/healthz',
      healthyHttpCodes:       '200-399',
      intervalSeconds:        30,
      timeoutSeconds:         5,
      healthyThresholdCount:  2,
      unhealthyThresholdCount: 3,
    };

    const alertsBuilder: ALERTS_BUILDER = {
      topicId:              'EcsAlertsTopic',
      displayName:          'Django ECS Alerts',
      emailSubscriptions:   [ecsConfig.alertEmailAddress], // ← from SSM, not hardcoded
      taskStoppedRuleId:    'EcsTaskStoppedRule',
      taskStoppedStopCodes: ['TaskFailedToStart', 'EssentialContainerExited'],
    };

    new EcsBuilder(this, 'App', props)
      .withCluster(clusterBuilder)
      .withLogGroup(logGroupBuilder)
      .withRepo('djangoproject')
      .withSecurityGroup()
      .withServiceSecrets({ secretsBag })
      .withDjangoAlbFargateService(fargateBuilder)
      .withAdotSidecar(adotBuilder)
      .withXRayPermissions()
      .allowAlbToTasks(albToTasksBuilder)
      .withHealthCheck(healthCheckBuilder)
      .withAlerts(alertsBuilder)
      .outputs();

    cdk.Tags.of(this).add('ManagedBy', 'waney93-aws-reference-architecture');
  }

  // ── Secrets ──────────────────────────────────────────────────────────────
  // Secret *names* now arrive from SSM — no string literals here.

  private createSecretsBag(
    auroraSecretName: string,
    oidcSecretName:   string,
  ): ServiceSecretsBag {
    const secretsBag: ServiceSecretsBag = {};

    const auroraSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'AuroraSecret', auroraSecretName,
    );
    const oidcSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'OidcSecret', oidcSecretName,
    );

    secretsBag.POSTGRES_HOST     = ecs.Secret.fromSecretsManager(auroraSecret, 'host');
    secretsBag.POSTGRES_PORT     = ecs.Secret.fromSecretsManager(auroraSecret, 'port');
    secretsBag.POSTGRES_USER     = ecs.Secret.fromSecretsManager(auroraSecret, 'username');
    secretsBag.POSTGRES_PASSWORD = ecs.Secret.fromSecretsManager(auroraSecret, 'password');
    secretsBag.POSTGRES_DB       = ecs.Secret.fromSecretsManager(auroraSecret, 'dbname');

    const cognitoSettings = [
      'OIDC_RP_CLIENT_ID',
      'OIDC_RP_CLIENT_SECRET',
      'COGNITO_USER_POOL_ID',
      'COGNITO_CUSTOM_DOMAIN',
      'COGNITO_HOSTED_UI_BASE_URL',
    ];
    cognitoSettings.forEach((key) => {
      secretsBag[key] = ecs.Secret.fromSecretsManager(oidcSecret, key);
    });

    return secretsBag;
  }
}