import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseInfrastructureBuilderProps } from '../interfaces/base-infrastructure';
import { Network } from '../constructs/network';
import { RdsBastion } from '../constructs/rds-bastion/rds-bastion';
import {
  getResourceParameterConfig,
  ResourceConfigFacade,
  Stage,
} from '../config/environment';
import { AuroraDB } from '../constructs/rds/aurora';
import { SecurityGroupConfig } from '../interfaces/common';
import {
  IParameterResolver,
  ResolvedDatabaseCredentials,
} from '../interfaces/parameter-resolver';

import { BastionIamRole } from '../constructs/rds-bastion/bastion-iam-role';
import { RdsBastionConfig } from '../interfaces/bastion';
import { IRdsIngressSource } from '../interfaces/rds';

/**
 * BaseInfrastructureBuilder
 *
 * Purpose:
 *   Composition layer that orchestrates one or more constructs into a cohesive
 *   feature (e.g., Cognito, VPC, ECS, CI/CD).
 *
 * Notes:
 *   - Apply defaults + normalize props here.
 *   - Keep public methods fluent (return this) to support chaining.
 */
export class BaseInfrastructureBuilder {
  public network?: Network;
  private readonly scope: Construct;
  private readonly idPrefix: string;
  private readonly props: Required<BaseInfrastructureBuilderProps>;

  private appClientSg?: ec2.SecurityGroup;
  private data?: AuroraDB;
  private bastion?: RdsBastion;

  /**
   * BaseInfrastructureBuilder constructor creates a builder that orchestrates
   * one or more constructs into a cohesive feature.
   * @param scope - The construct scope
   * @param idPrefix - The ID prefix for the resources
   * @param props - The builder properties
   */
  constructor(
    scope: Construct,
    idPrefix: string,
    props: BaseInfrastructureBuilderProps,
  ) {
    this.scope = scope;
    this.idPrefix = idPrefix;

    this.props = {
      ...props,
    } as Required<BaseInfrastructureBuilderProps>;
  }

  /**
   * withNetwork adds a VPC and related network resources to the builder.
   */
  public withNetwork(): this {
    this.network = new Network(this.scope, `${this.idPrefix}-Network`, {
      ...this.props.network,
    });
    return this;
  }

  /**
   * withRdsBastion adds a bastion host for RDS access to the builder.
   */
  public withRdsBastion(config: RdsBastionConfig): this {
    if (!this.network) {
      throw new Error('withNetwork() must be called before withRdsBastion().');
    }
    const roleProvider = new BastionIamRole(
      this.scope,
      `${this.idPrefix}-BastionRole`,
    );

    this.bastion = new RdsBastion(this.scope, `${this.idPrefix}-RdsBastion`, {
      network: { vpc: this.network.vpc },
      securityGroup: config.securityGroup,
      instance: config.instance,
      roleProvider,
      runCommandDocumentName: config.runCommandDocumentName,
      migrationStorage: config.migrationStorage,
    });

    return this;
  }
  /**
   * Adds a security group for application clients that need access to the network.
   */
  public withAppClientSecurityGroup(): this {
    if (!this.network)
      throw new Error(
        'Call withNetwork() before withAppClientSecurityGroup().',
      );

    this.appClientSg = new ec2.SecurityGroup(this.scope, 'AppClientSg', {
      vpc: this.network.vpc,
      description:
        'Shared SG for app workloads that need access to the network (e.g., ECS tasks, Lambda functions)',
      allowAllOutbound: true,
    });
    return this;
  }

  public withAuroraDB(): this {
    if (!this.props.rds)
      throw new Error('withAuroraDB() called but rds config is not set.');
    if (!this.network) throw new Error('Call withNetwork() before withAuroraDB().');
    if (!this.bastion)
      throw new Error('Call withRdsBastion() before withAuroraDB().');
    if (!this.appClientSg)
      throw new Error('Call withAppClientSecurityGroup() before withAuroraDB().');

    const ingressSources: IRdsIngressSource[] = [
      {
        securityGroup: this.bastion.securityGroup,
        portRules: this.props.rds.bastionPortRules,
      },
      {
        securityGroup: this.appClientSg,
        portRules: this.props.rds.appClientPortRules,
      },
    ];

    const credentials = this.getRdsClusterConfig(
      this.props.rds.parameterResolver,
      this.props.stage,
    );

    this.data = new AuroraDB(this.scope, `${this.idPrefix}-Data`, {
      network: { vpc: this.network.vpc },
      ingressSources,
      cluster: {
        id: this.props.rds.id,
        name: this.props.rds.name,
        databaseName: this.props.rds.databaseName,
        deletionProtection: this.props.rds.deletionProtection,
        capacity: this.props.rds.capacity,
        readers: this.props.rds.readers,
        admin: {
          username: credentials.adminUsername,
          secretName: credentials.loginSecretName,
        },
      },
      appUser: {
        username: credentials.appUserName,
        secretName: credentials.appUserSecretName,
      },
    });

    return this;
  }


  private getRdsClusterConfig(
    parameterResolver: IParameterResolver,
    stage: Stage,
  ): ResolvedDatabaseCredentials {
    const resourceConfig = new ResourceConfigFacade(
      parameterResolver,
      getResourceParameterConfig(stage),
    );
    return resourceConfig.getDatabaseCredentials();
  }

  /**
   * Optional: define CDK outputs in one place.
   */
  public outputs(): this {
    if (this.network) {
      new cdk.CfnOutput(this.scope, 'VpcId', {
        value: this.network.vpc.vpcId,
        exportName:
          ResourceConfigFacade.ExportedValueName.network?.vpcId || 'vpc_id',
      });
    }
    if (this.appClientSg) {
      new cdk.CfnOutput(this.scope, 'AppClientSgId', {
        value: this.appClientSg.securityGroupId,
        exportName:
          ResourceConfigFacade.ExportedValueName.network?.appClientSgId ||
          'app_client_sg_id',
      });
    }
    return this;
  }
}
