import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3StorageConstructProps } from '../interfaces/shared-services-old';

/**
 * S3StorageConstruct
 *
 * Purpose:
 *   Construct to define resources related to S3 storage, such as S3 buckets.
 */
export class S3StorageConstruct extends Construct {
  public readonly bucket: Bucket;
  constructor(scope: Construct, id: string, props: S3StorageConstructProps) {
    super(scope, id);
    const {
      name,
      removalPolicy,
      autoDeleteObjects,
      bucketId,
      enforceSSL = true,
      versioned = true,
      encryption = cdk.aws_s3.BucketEncryption.S3_MANAGED,
    } = props;
    //Create an S3 bucket for migration storage as an example
    this.bucket = new Bucket(this, bucketId, {
      bucketName: name,
      removalPolicy: removalPolicy,
      autoDeleteObjects: autoDeleteObjects,
      enforceSSL: enforceSSL,
      versioned: versioned,
      encryption: encryption,
    });
  }
}
