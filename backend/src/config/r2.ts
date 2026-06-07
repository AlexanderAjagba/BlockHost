import { S3Client } from "@aws-sdk/client-s3";

interface R2Config {
  bucketName: string;
  client: S3Client;
}

let r2Config: R2Config | undefined;

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const getR2Config = (): R2Config => {
  if (r2Config) {
    return r2Config;
  }

  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = requireEnv("R2_BUCKET_NAME");

  r2Config = {
    bucketName,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };

  return r2Config;
};
