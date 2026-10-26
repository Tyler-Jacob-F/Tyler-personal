import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { config } from './config.js';

/**
 * Static hosting: a private S3 bucket behind CloudFront, SPA fallback via a CloudFront
 * Function, TLS from ACM, DNS in the Route 53 zone the domain was registered with.
 * CI uploads the built SPA after `cdk deploy`; see .github/workflows/deploy.yml.
 */
export interface SiteStackProps extends cdk.StackProps {
  /** Hostname of the HTTP API; CloudFront forwards /api/* there unchanged. */
  apiDomainName: string;
}

export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const { domainName } = config;
    const www = `www.${domainName}`;

    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName });

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: config.siteBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      subjectAlternativeNames: [www],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // Requests for extensionless paths get index.html so React Router can own the URL.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${config.siteName} (${domainName})`,
      domainNames: [domainName, www],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        // One origin for browsers: the API rides the same domain, so no CORS. Nothing is
        // cached and every viewer header except Host (the Authorization bearer included)
        // reaches API Gateway.
        '/api/*': {
          origin: new origins.HttpOrigin(props.apiDomainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
        },
      },
    });

    for (const [name, recordName] of [
      ['Apex', domainName],
      ['Www', www],
    ] as const) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, `${name}A`, { zone, recordName, target });
      new route53.AaaaRecord(this, `${name}Aaaa`, { zone, recordName, target });
    }

    new cdk.CfnOutput(this, 'SiteBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${domainName}` });
  }
}
