import { useState } from 'react';
import { Cloud, Eye, EyeOff, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { testR2Connection } from '../lib/storage';

interface StorageConfigSectionProps {
  storeId: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  onSettingChange: (key: string, value: string) => Promise<void>;
  disabled?: boolean;
}

export function StorageConfigSection({
  storeId,
  r2AccountId,
  r2AccessKeyId,
  r2SecretAccessKey,
  r2BucketName,
  r2PublicUrl,
  onSettingChange,
  disabled = false,
}: StorageConfigSectionProps) {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const isR2Configured = !!(r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName && r2PublicUrl);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testR2Connection(storeId);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Cloud className="w-5 h-5 text-blue-600" />
        <h4 className="text-sm font-medium text-gray-900">Cloudflare R2 Storage Configuration</h4>
      </div>

      {!isR2Configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">R2 Storage Not Configured</p>
              <p className="text-sm text-amber-700 mt-1">
                Please configure all fields below to enable photo uploads. Without R2 configuration, photo uploads will not work.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Account ID */}
        <div>
          <label htmlFor="r2_account_id" className="block text-sm font-medium text-gray-700 mb-1">
            Cloudflare Account ID
          </label>
          <input
            id="r2_account_id"
            type="text"
            value={r2AccountId}
            onChange={(e) => onSettingChange('r2_account_id', e.target.value)}
            placeholder="Enter your Cloudflare Account ID"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Found in your Cloudflare dashboard URL (32-character alphanumeric string)
          </p>
        </div>

        {/* Access Key ID */}
        <div>
          <label htmlFor="r2_access_key_id" className="block text-sm font-medium text-gray-700 mb-1">
            R2 Access Key ID
          </label>
          <input
            id="r2_access_key_id"
            type="text"
            value={r2AccessKeyId}
            onChange={(e) => onSettingChange('r2_access_key_id', e.target.value)}
            placeholder="Enter your R2 Access Key ID"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Create an API token in Cloudflare R2 settings with read/write permissions
          </p>
        </div>

        {/* Secret Access Key */}
        <div>
          <label htmlFor="r2_secret_access_key" className="block text-sm font-medium text-gray-700 mb-1">
            R2 Secret Access Key
          </label>
          <div className="relative">
            <input
              id="r2_secret_access_key"
              type={showSecretKey ? 'text' : 'password'}
              value={r2SecretAccessKey}
              onChange={(e) => onSettingChange('r2_secret_access_key', e.target.value)}
              placeholder="Enter your R2 Secret Access Key"
              disabled={disabled}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Keep this secret. It will be stored securely and used server-side only.
          </p>
        </div>

        {/* Bucket Name */}
        <div>
          <label htmlFor="r2_bucket_name" className="block text-sm font-medium text-gray-700 mb-1">
            R2 Bucket Name
          </label>
          <input
            id="r2_bucket_name"
            type="text"
            value={r2BucketName}
            onChange={(e) => onSettingChange('r2_bucket_name', e.target.value)}
            placeholder="Enter your R2 bucket name"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Create a bucket in Cloudflare R2 dashboard first
          </p>
        </div>

        {/* Public URL */}
        <div>
          <label htmlFor="r2_public_url" className="block text-sm font-medium text-gray-700 mb-1">
            R2 Public URL
          </label>
          <input
            id="r2_public_url"
            type="text"
            value={r2PublicUrl}
            onChange={(e) => onSettingChange('r2_public_url', e.target.value)}
            placeholder="https://cdn.yourdomain.com or https://pub-xxxx.r2.dev"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Public URL for serving files (custom domain or R2 public bucket URL)
          </p>
        </div>

        {/* Test Connection Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={disabled || isTesting || !isR2Configured}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                Test R2 Connection
              </>
            )}
          </button>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
                testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Connection successful! R2 is ready to use.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Connection failed: {testResult.error}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
