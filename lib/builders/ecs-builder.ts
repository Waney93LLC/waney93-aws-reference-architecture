// ecs/builder/ecs-builder.ts
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import {
  ECS_CLUSTER_BUILDER,
  ECS_LOG_GROUP_BUILDER,
  EcsBuilderProps,
  EcsServiceSecretsConfig,
} from '../interfaces/ecs';
import { ResourceConfigFacade } from '../config/environment';

/**
 * EcsBuilder
 *
 * Purpose:
 *   Builder for ECS-related resources.
 *   Keep this focused on ECS and related resources (ALB, CloudWatch Logs, etc).
 *   Avoid unrelated resources (e.g. Cognito, SSM parameters) to keep it reusable.
 *
 *   Note: this builder is not meant to be a one-size-fits-all for every ECS use case.
 *   It’s designed for the specific needs of this reference architecture, but can be adapted as needed.
 */
export class EcsBuilder {
  // Optional “built artifacts” (same style as CognitoBuilder)
  public cluster?: ecs.Cluster;
  public repo?: ecr.IRepository;
  public logGroup?: logs.ILogGroup;

  public serviceSg?: ec2.ISecurityGroup;

  public service?: ApplicationLoadBalancedFargateService;
  public web?: ecs.ContainerDefinition;
  public adot?: ecs.ContainerDefinition;

  public alertsTopic?: sns.Topic;
  public stoppedRule?: events.Rule;

  /**
   * Normalized service secrets configuration.
   * (kept private; callers still use withServiceSecrets)
   */
  private serviceSecrets?: EcsServiceSecretsConfig;

  /**
   * Creates an instance of EcsBuilder with the given scope, id prefix, and props.
   * @param scope The Construct scope in which to define resources.
   * @param idPrefix A prefix for resource IDs to ensure uniqueness.
   * @param props The properties for configuring the ECS resources.
   * Note: props is intentionally kept minimal; you can expand it as needed.
   * For example, you could add more configuration options for the cluster, service, etc.
   */
  constructor(
    private readonly scope: Construct,
    private readonly idPrefix: string,
    private readonly props: EcsBuilderProps,
  ) {}

  /**
   * Adds an ECS cluster to the builder. You can configure the cluster id and name
   * if id or name is not provided then the default value for the id will be
   * `${idPrefix}cluster-id` and for the name will be `${idPrefix}cluster-name` as well.
   * @returns this
   */
  public withCluster(ecsClusterBuilder?: ECS_CLUSTER_BUILDER): this {
    const { network } = ResourceConfigFacade.ExportedValueName;
    if (!network) {
      throw new Error('Network config not found in CloudFormation exports.');
    }
    if (!network.vpcId) {
      throw new Error('VPC ID not found in CloudFormation exports.');
    }

    const region = cdk.Stack.of(this.scope).region;
    const vpcExportedId = cdk.Fn.importValue(network.vpcId);
    const importedVpc = ec2.Vpc.fromVpcAttributes(this.scope, 'ImportedVPC', {
      vpcId: vpcExportedId,
      availabilityZones: cdk.Fn.getAzs(region),
    });
    this.cluster = new ecs.Cluster(
      this.scope,
      ecsClusterBuilder?.id ?? `${this.idPrefix}cluster-id`,
      {
        vpc: importedVpc,
        clusterName: ecsClusterBuilder?.name ?? `${this.idPrefix}cluster-name`,
      },
    );
    return this;
  }

  /**
   * Adds an ECR repository to the builder by repository name. The repository must already exist.
   * @param imageRepoName The name of the existing ECR repository to use (ususally located from the Shared services stack).
   * @returns this
   */
  public withRepo(imageRepoName: string): this {
    this.repo = ecr.Repository.fromRepositoryName(
      this.scope,
      `${this.idPrefix}${imageRepoName}`,
      imageRepoName,
    );
    return this;
  }

  /**
   * Adds a CloudWatch Logs log group to the builder. You can configure the log group name, retention, and removal policy.
   * @param logGroupBuilder Optional configuration for the log group.
   * @returns this
   */
  public withLogGroup(logGroupBuilder?: ECS_LOG_GROUP_BUILDER): this {
    this.logGroup = new logs.LogGroup(
      this.scope,
      `${this.idPrefix}${logGroupBuilder?.id ?? 'ECSLogGroup'}`,
      {
        logGroupName: logGroupBuilder?.name ?? '/ecs/log-group',
        retention: logGroupBuilder?.retention ?? logs.RetentionDays.ONE_DAY,
        removalPolicy:
          logGroupBuilder?.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
      },
    );
    return this;
  }

  /**
   * Imported the app client security group created in the Network stack and adds it to the builder.
   * @returns this
   */
  public withSecurityGroup(): this {
    if (!ResourceConfigFacade.ExportedValueName.network?.appClientSgId) {
      throw new Error('App Client SG ID not found in CloudFormation exports.');
    }
    const appClientSgId = cdk.Fn.importValue(
      ResourceConfigFacade.ExportedValueName.network.appClientSgId,
    );

    const appClientSg = ec2.SecurityGroup.fromSecurityGroupId(
      this.scope,
      'ImportedAppClientSg',
      appClientSgId,
    );

    this.serviceSg = appClientSg;

    return this;
  }

  /**
   * Adds a configuration for service secrets, which can be used in addAlbFargateService. You can specify requiredKeys to enforce that certain secrets must be present before addAlbFargateService can be called.
   * @param config Configuration for service secrets.
   * @returns this
   */
  public withServiceSecrets(config: EcsServiceSecretsConfig): this {
    this.serviceSecrets = {
      requiredKeys: config.requiredKeys ?? [
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'OIDC_RP_CLIENT_SECRET',
      ],
      secretsBag: config.secretsBag ?? {},
    };

    return this;
  }

  public withAlbFargateService(): this {
    if (!this.cluster)
      throw new Error('Call withCluster() before withAlbFargateService().');
    if (!this.repo)
      throw new Error('Call withRepo() before withAlbFargateService().');
    if (!this.logGroup)
      throw new Error('Call withLogGroup() before withAlbFargateService().');
    if (!this.serviceSg)
      throw new Error(
        'Call withSecurityGroup() before withAlbFargateService().',
      );

    const secretsBag = this.serviceSecrets?.secretsBag;
    if (!secretsBag) {
      throw new Error(
        'Call withServiceSecrets({ secretsBag }) before withAlbFargateService().',
      );
    }

    // const apiCert = acm.Certificate.fromCertificateArn(
    //   this.scope,
    //   `${this.idPrefix}ApiCert`,
    //   this.props.apiCertArn,
    // );
    // const {ECS_CONFIG} = Config;

    // this.service = new ApplicationLoadBalancedFargateService(
    //   this.scope,
    //   `${this.idPrefix}${ECS_CONFIG.SERVICE.ID}`,
    //   {
    //     cluster: this.cluster,
    //     serviceName: this.props.serviceName,
    //     publicLoadBalancer:
    //       ECS_CONFIG.SERVICE.PUBLIC_LOAD_BALANCER,
    //     loadBalancerName: ECS_CONFIG.SERVICE.PUBLIC_LOAD_BALANCER_NAME,
    //     enableExecuteCommand:
    //       ECS_CONFIG.SERVICE.ENABLE_EXECUTE_COMMAND,
    //     desiredCount:
    //       ECS_CONFIG.SERVICE.DESIRED_COUNT,

    //     listenerPort:
    //       ECS_CONFIG.SERVICE.LISTENER_PORT,

    //     protocol: elbv2.ApplicationProtocol.HTTPS,
    //     certificate: apiCert,
    //     sslPolicy: elbv2.SslPolicy.RECOMMENDED,

    //     taskSubnets: { subnets: this.props.vpc.privateSubnets },
    //     securityGroups: [this.serviceSg],

    //     cpu:ECS_CONFIG.SERVICE.TASK_CPU,
    //     memoryLimitMiB: ECS_CONFIG.SERVICE.TASK_MEMORY_MIB,

    //     taskImageOptions: {
    //       family: ECS_CONFIG.SERVICE.TASK_DEFINITION_FAMILY,
    //       containerName: ECS_CONFIG.SERVICE.WEB_CONTAINER_NAME,
    //       image: ecs.ContainerImage.fromEcrRepository(
    //         this.repo,
    //         this.props.imageTag,
    //       ),
    //       containerPort: ECS_CONFIG.SERVICE.CONTAINER_PORT,
    //       logDriver: new ecs.AwsLogDriver({
    //         logGroup: this.logGroup,
    //         streamPrefix: ECS_CONFIG.LOGS.STREAM_PREFIX_WEB,
    //       }),

    //       environment: {
    //         ENGINE:ECS_CONFIG.APP_ENV.ENGINE,
    //         OTEL_EXPORTER_OTLP_ENDPOINT: ECS_CONFIG.APP_ENV.OTEL_EXPORTER_OTLP_ENDPOINT,
    //         OTEL_EXPORTER_OTLP_PROTOCOL: ECS_CONFIG.APP_ENV.OTEL_EXPORTER_OTLP_PROTOCOL,
    //         AWS_REGION: ECS_CONFIG.REGION,
    //         DJANGO_ALLOWED_HOSTS: ECS_CONFIG.APP_ENV.APP_DOMAIN.ALLOWED_HOSTS,
    //         // COGNITO_USER_POOL_ID: Config.COGNITO_CONFIG.USER_POOL_ID,
    //         // COGNITO_DOMAIN: Config.COGNITO_CONFIG.DOMAIN_URL,
    //         // OIDC_RP_CLIENT_ID: Config.COGNITO_CONFIG.CLIENT_ID,
    //         OTEL_SERVICE_NAME: this.props.serviceName,
    //       },

    //       secrets: secretsBag,
    //       command: ECS_CONFIG.GUNICORN.COMMAND,
    //     },
    //   },
    // );
    /**
     *     APP_ENV: {
      USE_RDS: 'true',
      ENGINE: 'django.db.backends.postgresql',

      // OTEL
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    },
     */

    // HTTP -> HTTPS redirect listener
    // this.service.loadBalancer.addListener(`${this.idPrefix}HttpRedirect`, {
    //   port: 80,
    //   protocol: elbv2.ApplicationProtocol.HTTP,
    //   defaultAction: elbv2.ListenerAction.redirect({
    //     protocol: 'HTTPS',
    //     port: '443',
    //     permanent: true,
    //   }),
    // });

    // const web = this.service.taskDefinition.defaultContainer;
    // if (!web)
    //   throw new Error('Default container (web) was not created as expected.');

    // this.web = web;
    return this;
  }

  public withAdotSidecar(): this {
    // const escDotCommand = ECS_CONFIG.ADOT.COMMAND;
    // if (!escDotCommand) {
    //   throw new Error(
    //     'ECS_CONFIG/ADOT/COMMAND is required in config to use withAdotSidecar().',
    //   );
    // }

    if (!this.service)
      throw new Error('Call withAlbFargateService() before withAdotSidecar().');
    if (!this.web)
      throw new Error(
        'Web container missing (withAlbFargateService should set it).',
      );
    if (!this.logGroup)
      throw new Error('Call withLogGroup() before withAdotSidecar().');

    // const adot = this.service.taskDefinition.addContainer(
    //   ECS_CONFIG.ADOT.CONTAINER_NAME,
    //   {
    //     image: ecs.ContainerImage.fromRegistry(ECS_CONFIG.ADOT.IMAGE),
    //     essential: false,
    //     memoryReservationMiB: ECS_CONFIG.ADOT.MEMORY_RESERVATION_MIB,
    //     logging: new ecs.AwsLogDriver({
    //       logGroup: this.logGroup,
    //       streamPrefix: ECS_CONFIG.LOGS.STREAM_PREFIX_ADOT,
    //     }),
    //     environment: {
    //       AWS_REGION: ECS_CONFIG.REGION,
    //       OTEL_COLLECTOR_CONFIG: ECS_CONFIG.ADOT.OTEL_CONFIG_YAML,
    //     },
    //     command: escDotCommand,
    //     healthCheck: {
    //       command: ECS_CONFIG.ADOT.HEALTHCHECK.COMMAND,
    //       interval: cdk.Duration.seconds(ECS_CONFIG.ADOT.HEALTHCHECK.INTERVAL_SECONDS),
    //       timeout: cdk.Duration.seconds(ECS_CONFIG.ADOT.HEALTHCHECK.TIMEOUT_SECONDS),
    //       retries: ECS_CONFIG.ADOT.HEALTHCHECK.RETRIES,
    //       startPeriod: cdk.Duration.seconds(ECS_CONFIG.ADOT.HEALTHCHECK.START_PERIOD_SECONDS),
    //     },
    //     },
    // );

    // adot.addPortMappings(
    //   { containerPort: ECS_CONFIG.ADOT.PORTS.OTLP_GRPC, protocol: ecs.Protocol.TCP },
    //   { containerPort: ECS_CONFIG.ADOT.PORTS.OTLP_HTTP, protocol: ecs.Protocol.TCP },
    //   { containerPort: ECS_CONFIG.ADOT.PORTS.HEALTH, protocol: ecs.Protocol.TCP },
    // );

    // this.web.addContainerDependencies({
    //   container: adot,
    //   condition: ecs.ContainerDependencyCondition.START,
    // });

    // this.adot = adot;
    return this;
  }

  public withXRayPermissions(): this {
    if (!this.service)
      throw new Error(
        'Call withAlbFargateService() before withXRayPermissions().',
      );

    this.service.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      }),
    );

    return this;
  }

  public allowAlbToTasks(): this {
    // if (!this.service)
    //   throw new Error('Call withAlbFargateService() before allowAlbToTasks().');

    // this.service.service.connections.allowFrom(
    //   this.service.loadBalancer,
    //   ec2.Port.tcp(ECS_CONFIG.SERVICE.CONTAINER_PORT),
    //   ECS_CONFIG.SECURITY_GROUP.ALB_TO_TASK_RULE_DESC,
    // );

    // this.service.loadBalancer.connections.allowFrom(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.tcp(ECS_CONFIG.SERVICE.LISTENER_PORT),
    //   'Allow HTTPS from internet',
    // );

    return this;
  }

  public withHealthCheck(): this {
    // const { ECS_CONFIG } = Config;

    if (!this.service)
      throw new Error('Call withAlbFargateService() before withHealthCheck().');

    // this.service.targetGroup.configureHealthCheck({
    //   path: ECS_CONFIG.SERVICE.HEALTHCHECK.PATH,
    //   healthyHttpCodes: ECS_CONFIG.SERVICE.HEALTHCHECK.HEALTHY_HTTP_CODES,
    //   interval: cdk.Duration.seconds(ECS_CONFIG.SERVICE.HEALTHCHECK.INTERVAL_SECONDS),
    //   timeout: cdk.Duration.seconds(ECS_CONFIG.SERVICE.HEALTHCHECK.TIMEOUT_SECONDS),
    //   healthyThresholdCount: ECS_CONFIG.SERVICE.HEALTHCHECK.HEALTHY_THRESHOLD,
    //   unhealthyThresholdCount: ECS_CONFIG.SERVICE.HEALTHCHECK.UNHEALTHY_THRESHOLD,
    // });

    return this;
  }

  public withAlerts(): this {
    // const { ECS_CONFIG } = Config;

    if (!this.cluster)
      throw new Error('Call withCluster() before withAlerts().');

    // const topic = new sns.Topic(
    //   this.scope,
    //   `${this.idPrefix}${ECS_CONFIG.ALERTS.TOPIC_ID}`,
    //   {
    //     displayName: ECS_CONFIG.ALERTS.DISPLAY_NAME,
    //   },
    // );

    // for (const email of ECS_CONFIG.ALERTS.EMAIL_SUBSCRIPTIONS) {
    //   topic.addSubscription(new subs.EmailSubscription(email));
    // }

    // const rule = new events.Rule(
    //   this.scope,
    //   `${this.idPrefix}${ECS_CONFIG.ALERTS.TASK_STOPPED_RULE_ID}`,
    //   {
    //     eventPattern: {
    //       source: ['aws.ecs'],
    //       detailType: ['ECS Task State Change'],
    //       detail: {
    //         clusterArn: [this.cluster.clusterArn],
    //         lastStatus: ['STOPPED'],
    //         stopCode: ECS_CONFIG.ALERTS.TASK_STOPPED_STOP_CODES,
    //       },
    //     },
    //   },
    // );

    // rule.addTarget(new targets.SnsTopic(topic));

    // this.alertsTopic = topic;
    // this.stoppedRule = rule;
    return this;
  }

  public outputs(): this {
    // const { ECS_CONFIG } = Config;
    if (!this.service)
      throw new Error('Call withAlbFargateService() before outputs().');

    const stack = cdk.Stack.of(this.scope);

    // new cdk.CfnOutput(
    //   stack,
    //   `${this.idPrefix}${ECS_CONFIG.OUTPUTS.LOAD_BALANCER_DNS_ID}`,
    //   {
    //     value: this.service.loadBalancer.loadBalancerDnsName,
    //   },
    // );

    new cdk.CfnOutput(stack, `${this.idPrefix}ALB_CanonicalHostedZoneID`, {
      value: this.service.loadBalancer.loadBalancerCanonicalHostedZoneId,
    });

    new cdk.CfnOutput(stack, `${this.idPrefix}AlbArn`, {
      value: this.service.loadBalancer.loadBalancerArn,
    });

    return this;
  }
}
