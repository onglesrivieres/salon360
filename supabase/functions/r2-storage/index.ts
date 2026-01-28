import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadBucketCommand } from 'npm:@aws-sdk/client-s3@3.400.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

async function getR2Config(supabase: ReturnType<typeof createClient>, storeId: string): Promise<R2Config | null> {
  const { data: settings, error } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name']);

  if (error || !settings) {
    console.error('Failed to fetch R2 settings:', error);
    return null;
  }

  const settingsMap = new Map(settings.map(s => [s.setting_key, s.setting_value]));

  const accountId = settingsMap.get('r2_account_id');
  const accessKeyId = settingsMap.get('r2_access_key_id');
  const secretAccessKey = settingsMap.get('r2_secret_access_key');
  const bucketName = settingsMap.get('r2_bucket_name');

  // All credentials must be present and non-empty
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId: String(accountId).replace(/^"|"$/g, ''),
    accessKeyId: String(accessKeyId).replace(/^"|"$/g, ''),
    secretAccessKey: String(secretAccessKey).replace(/^"|"$/g, ''),
    bucketName: String(bucketName).replace(/^"|"$/g, ''),
  };
}

function createS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function handleUpload(
  s3Client: S3Client,
  bucketName: string,
  path: string,
  file: ArrayBuffer,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: new Uint8Array(file),
      ContentType: contentType,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}

async function handleDelete(
  s3Client: S3Client,
  bucketName: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
}

async function handleDeleteMultiple(
  s3Client: S3Client,
  bucketName: string,
  paths: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: paths.map(path => ({ Key: path })),
      },
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Delete multiple error:', error);
    return { success: false, error: error.message };
  }
}

async function handleList(
  s3Client: S3Client,
  bucketName: string,
  prefix: string
): Promise<{ success: boolean; files?: Array<{ name: string; path: string; size?: number; lastModified?: string }>; error?: string }> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    const files = (response.Contents || []).map(obj => ({
      name: obj.Key?.split('/').pop() || '',
      path: obj.Key || '',
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString(),
    }));

    return { success: true, files };
  } catch (error) {
    console.error('List error:', error);
    return { success: false, error: error.message };
  }
}

async function handleTest(
  s3Client: S3Client,
  bucketName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new HeadBucketCommand({
      Bucket: bucketName,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Test connection error:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let storeId: string;
    let action: string;
    let path: string | undefined;
    let paths: string[] | undefined;
    let prefix: string | undefined;
    let file: ArrayBuffer | undefined;
    let contentType: string | undefined;

    // Parse request based on content type
    const contentTypeHeader = req.headers.get('content-type') || '';

    if (contentTypeHeader.includes('multipart/form-data')) {
      // Handle file upload via FormData
      const formData = await req.formData();
      storeId = formData.get('storeId') as string;
      path = formData.get('path') as string;
      contentType = formData.get('contentType') as string || 'application/octet-stream';
      action = 'upload';

      const fileData = formData.get('file') as File;
      if (fileData) {
        file = await fileData.arrayBuffer();
        if (!contentType || contentType === 'application/octet-stream') {
          contentType = fileData.type || 'application/octet-stream';
        }
      }
    } else {
      // Handle JSON request for other actions
      const body = await req.json();
      storeId = body.storeId;
      action = body.action || 'upload';
      path = body.path;
      paths = body.paths;
      prefix = body.prefix;
    }

    if (!storeId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing storeId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get R2 configuration for this store
    const r2Config = await getR2Config(supabase, storeId);

    if (!r2Config) {
      return new Response(
        JSON.stringify({ success: false, error: 'R2 not configured for this store' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const s3Client = createS3Client(r2Config);
    let result: { success: boolean; error?: string; files?: unknown };

    switch (action) {
      case 'upload':
        if (!path || !file) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing path or file' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        result = await handleUpload(s3Client, r2Config.bucketName, path, file, contentType || 'application/octet-stream');
        break;

      case 'delete':
        if (!path) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing path' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        result = await handleDelete(s3Client, r2Config.bucketName, path);
        break;

      case 'delete-multiple':
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing or empty paths array' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        result = await handleDeleteMultiple(s3Client, r2Config.bucketName, paths);
        break;

      case 'list':
        result = await handleList(s3Client, r2Config.bucketName, prefix || '');
        break;

      case 'test':
        result = await handleTest(s3Client, r2Config.bucketName);
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] R2 ${action} completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        ...result,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] R2 storage error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
