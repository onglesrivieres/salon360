import React, { useState } from 'react';
import { CheckCircle2, Circle, Loader2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';

interface ConfigurationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  storeId: string;
  storeName: string;
}

type PresetType = 'minimal' | 'recommended' | 'full';

const PRESET_INFO = {
  minimal: {
    title: 'Essential Only',
    description: 'Just the basics to get started. You can enable more features later.',
    features: [
      'Ticket approval system',
      'Opening cash count requirement',
      'Auto-checkout at closing',
    ],
    icon: Circle,
    color: 'blue',
  },
  recommended: {
    title: 'Recommended Setup',
    description: 'Best practices for most businesses. Includes essential + commonly used features.',
    features: [
      'All essential features',
      'Auto-approval after 48 hours',
      'Technician ready queue',
      'Queue button in header',
    ],
    icon: CheckCircle2,
    color: 'green',
    badge: 'Popular',
  },
  full: {
    title: 'Full Featured',
    description: 'All available features enabled. Perfect for established businesses.',
    features: [
      'All recommended features',
      'Self-service tickets',
      'Real-time data refresh',
      'Advanced approval workflows',
    ],
    icon: Sparkles,
    color: 'purple',
  },
};

export function ConfigurationWizard({
  isOpen,
  onClose,
  onComplete,
  storeId,
  storeName,
}: ConfigurationWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('recommended');
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 2;

  async function handleInitialize() {
    setIsInitializing(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('initialize_store_settings', {
        p_store_id: storeId,
        p_preset: selectedPreset,
      });

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to initialize settings');
      }

      onComplete();
    } catch (err: any) {
      console.error('Error initializing settings:', err);
      setError(err.message || 'Failed to initialize settings');
    } finally {
      setIsInitializing(false);
    }
  }

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to {storeName}!
          </h3>
          <p className="text-gray-600">
            Let's set up your store configuration. Choose a preset that matches your needs.
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(PRESET_INFO).map(([key, info]) => {
            const Icon = info.icon;
            const isSelected = selectedPreset === key;

            return (
              <button
                key={key}
                onClick={() => setSelectedPreset(key as PresetType)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? `border-${info.color}-500 bg-${info.color}-50`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isSelected ? `bg-${info.color}-100` : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isSelected ? `text-${info.color}-600` : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium ${
                        isSelected ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {info.title}
                      </h4>
                      {info.badge && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          {info.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {info.description}
                    </p>
                    <ul className="space-y-1">
                      {info.features.map((feature, i) => (
                        <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? `border-${info.color}-500 bg-${info.color}-500`
                      : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Note:</span> You can customize any setting after setup is complete.
          </p>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const preset = PRESET_INFO[selectedPreset];

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Review Your Configuration
          </h3>
          <p className="text-gray-600">
            Confirm your choices before initializing your store settings.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-${preset.color}-100`}>
              {React.createElement(preset.icon, {
                className: `w-6 h-6 text-${preset.color}-600`
              })}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{preset.title}</h4>
              <p className="text-sm text-gray-600">{preset.description}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">Included Features:</h5>
            <ul className="space-y-2">
              {preset.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">Ready to begin?</span> Clicking "Initialize Configuration" will set up {storeName} with your selected preset. This cannot be undone, but you can modify individual settings afterward.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Step {step} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500">Store Configuration</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

        <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-gray-200">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={isInitializing}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isInitializing}
            >
              Cancel
            </Button>
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleInitialize}
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  'Initialize Configuration'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
