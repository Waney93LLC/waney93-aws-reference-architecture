import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as events from 'aws-cdk-lib/aws-events';

import { OpsRunbookConstructProps } from '../interfaces/shared-services'; 
import { EventRouter } from '../constructs/event-router'; 
import { SsmAutomationTarget } from '../constructs/ssm-automation-target'; 

export class OpsRunbookConstruct extends Construct {
  public readonly runbookName: string;
  public readonly automationRole: iam.Role;
  public readonly eventBridgeInvokeRole: iam.Role;
  public readonly automationDocument: ssm.CfnDocument;

  // L2 rule now (instead of CfnRule)
  public readonly rule: events.Rule;

  constructor(scope: Construct, id: string, props: OpsRunbookConstructProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;
    if (!props.migrationOps) {
      throw new Error(
        'migrationOps config is required for OpsRunbookConstruct',
      );
    }
    const { target, runCommandDocumentName, automationRunbookName } =
      props.migrationOps;

    this.runbookName =
      automationRunbookName ?? 'RunBootstrapOnFoundationCreate';

    // Role assumed by SSM Automation executions (inside the runbook)
    this.automationRole = new iam.Role(this, 'AutomationAssumeRole', {
      assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
      description:
        'Role assumed by SSM Automation to run Run Command against target instance(s).',
    });

    this.automationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
          'ssm:ListCommands',
          'ssm:ListCommandInvocations',
        ],
        resources: ['*'],
      }),
    );

    // Automation runbook (Automation doc that calls an existing Command document)
    this.automationDocument = new ssm.CfnDocument(this, 'BootstrapRunbook', {
      documentType: 'Automation',
      name: this.runbookName,
      content: {
        schemaVersion: '0.3',
        description:
          'Triggered by EventBridge when stack completes; runs an existing Run Command document on target instance(s).',
        parameters: {
          AutomationAssumeRole: {
            type: 'String',
            description: '(Required) IAM role ARN that Automation will assume.',
          },
          TargetInstanceTagKey: {
            type: 'String',
            description: '(Required) Tag key used to target instance(s).',
          },
          TargetInstanceTagValue: {
            type: 'String',
            description: '(Required) Tag value used to target instance(s).',
          },
          RunCommandDocumentName: {
            type: 'String',
            default: runCommandDocumentName,
            description:
              '(Required) Existing SSM Run Command document name (type: Command).',
          },
        },
        assumeRole: '{{ AutomationAssumeRole }}',
        mainSteps: [
          {
            name: 'RunBootstrapCommand',
            action: 'aws:runCommand',
            inputs: {
              DocumentName: '{{ RunCommandDocumentName }}',
              Targets: [
                {
                  Key: 'tag:{{ TargetInstanceTagKey }}',
                  Values: ['{{ TargetInstanceTagValue }}'],
                },
              ],
            },
          },
        ],
      },
    });

    /**
     * Role assumed by EventBridge to invoke SSM Automation.
     */
    this.eventBridgeInvokeRole = new iam.Role(this, 'EventBridgeInvokeRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('events.amazonaws.com'),
        new iam.ServicePrincipal('ssm.amazonaws.com'),
      ),
      description:
        'Role assumed by EventBridge/SSM to start SSM Automation executions.',
    });

    this.eventBridgeInvokeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:StartAutomationExecution'],
        resources: ['*'],
      }),
    );

    this.eventBridgeInvokeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [this.automationRole.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'ssm.amazonaws.com' },
        },
      }),
    );

    const automationDefinitionArn = `arn:aws:ssm:${region}:${account}:automation-definition/${this.runbookName}`;

    const targetInput: Record<string, string[]> = {
      AutomationAssumeRole: [this.automationRole.roleArn],
      TargetInstanceTagKey: [target.instance.tagKey],
      TargetInstanceTagValue: [target.instance.tagValue],
      RunCommandDocumentName: [runCommandDocumentName],
    };

    const triggeredStackName = cdk.Stack.of(this).stackName; 
    const eventPattern: events.EventPattern = {
      source: ['aws.cloudformation'],
      detailType: ['CloudFormation Stack Status Change'],
      detail: {
        'stack-id': [
          {
            prefix: `arn:aws:cloudformation:${region}:${account}:stack/${triggeredStackName}/`,
          },
        ],
        'status-details': {
          status: ['CREATE_COMPLETE'],
        },
      },
    };

    const router = new EventRouter(this, 'OpsRunbookRouter', {
      routes: [
        {
          name: 'OnTargetStackCreateComplete',
          eventPattern,
          targets: [
            new SsmAutomationTarget(
              automationDefinitionArn,
              this.eventBridgeInvokeRole,
              targetInput,
            ),
          ],
        },
      ],
    });

    this.rule = router.rules[0];
  }
}
