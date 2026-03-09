import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { IParameterResolver } from '../interfaces/parameter-resolver';

/**
 * SsmParameterResolver
 *
 * Purpose:
 *   Implementation of IParameterResolver that retrieves parameters from AWS Systems Manager Parameter Store.
 *   This allows for centralized management of configuration values and secrets, and decouples parameter retrieval from the rest of the application logic.
 */
export class SsmParameterResolver implements IParameterResolver {
    /**
     * Creates an instance of SsmParameterResolver.
     * @param scope - The construct scope
     */
  constructor(private readonly scope: Construct) {}

  public getString(name: string): string {
    return ssm.StringParameter.valueForStringParameter(this.scope, name);
  }

  public getStrings(names: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(names).map(([key, paramName]) => [
        key,
        ssm.StringParameter.valueForStringParameter(this.scope, paramName),
      ]),
    );
  }
}
