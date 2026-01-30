const { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const accountId = '3c39c225b3a27de7822833feb24b65b1';
const accessKeyId = '6b2fd38ca00ddee3e2a125299ce7cadb';
const secretAccessKey = 'ca45acf47636d73b852ac145da184b0b6aabcbb4a27671b422a6019f239ec715';
const bucketName = 'onopo-storage';

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
});

async function main() {
    console.log('Checking current CORS configuration...');
    try {
        const data = await client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
        console.log('Current CORS:', JSON.stringify(data.CORSRules, null, 2));
    } catch (err) {
        if (err.name === 'NoSuchCORSConfiguration') {
            console.log('No CORS configuration found.');
        } else {
            console.error('Error getting CORS:', err);
        }
    }

    console.log('\nApplying new permissive CORS configuration...');
    const corsParams = {
        Bucket: bucketName,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
                    AllowedOrigins: ['*'],
                    ExposeHeaders: ['ETag'],
                    MaxAgeSeconds: 3000,
                },
            ],
        },
    };

    try {
        await client.send(new PutBucketCorsCommand(corsParams));
        console.log('Successfully updated CORS configuration.');
    } catch (err) {
        console.error('Error setting CORS:', err);
    }

    // Verify again
    console.log('\nVerifying new configuration...');
    try {
        const data = await client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
        console.log('New CORS:', JSON.stringify(data.CORSRules, null, 2));
    } catch (err) {
        console.error('Error getting CORS:', err);
    }
}

main();
