import { S3Client, GetBucketCorsCommand, ListObjectsV2Command, HeadObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

// Read .env manually since we are running a script
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) envVars[key.trim()] = val.join('=').trim();
});

const accountId = envVars.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = envVars.R2_ACCESS_KEY_ID;
const secretAccessKey = envVars.R2_SECRET_ACCESS_KEY;
const bucketName = envVars.R2_BUCKET_NAME || 'onopo-storage';

if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error("Missing R2 credentials in .env");
    process.exit(1);
}

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

async function checkR2() {
    console.log("Checking R2 Bucket:", bucketName);

    // 1. Check CORS
    try {
        console.log("\n--- Checking CORS ---");
        const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucketName }));
        console.log("CORS Allowed Origins:", JSON.stringify(cors.CORSRules[0].AllowedOrigins));
    } catch (e) {
        console.log("No CORS configuration found or error:", e.message);

        // Suggest fixing CORS
        console.log("SUGGESTION: You should enable CORS for mobile/web compatibility.");

        // Uncomment to auto-fix
        // await setCors();
    }

    // 2. Check File Headers (Content-Type)
    try {
        console.log("\n--- Checking File Headers (First 5) ---");
        const list = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 5 }));

        if (list.Contents) {
            for (const item of list.Contents) {
                const head = await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: item.Key }));
                console.log(`File: ${item.Key}`);
                console.log(`  Size: ${item.Size}`);
                console.log(`  Content-Type: ${head.ContentType}`);
                console.log(`  Cache-Control: ${head.CacheControl}`);
            }
        } else {
            console.log("Bucket is empty.");
        }
    } catch (e) {
        console.error("Error listing objects:", e);
    }
}

async function setCors() {
    console.log("Setting default CORS rules...");
    try {
        await s3.send(new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "HEAD"],
                        AllowedOrigins: ["*"], // Allow all for public images
                        ExposeHeaders: [],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        }));
        console.log("CORS updated successfully!");
    } catch (e) {
        console.error("Failed to set CORS:", e);
    }
}

checkR2().catch(console.error);
