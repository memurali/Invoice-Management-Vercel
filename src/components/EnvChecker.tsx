'use client';

import { useState } from 'react';

export const EnvChecker = () => {
  const [showDebug, setShowDebug] = useState(false);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  const envVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_API_BASE_URL'
  ];

  const envStatus = envVars.map(varName => ({
    name: varName,
    value: process.env[varName],
    isSet: !!process.env[varName]
  }));

  const missingVars = envStatus.filter(env => !env.isSet);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowDebug(!showDebug)}
        className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${
          missingVars.length > 0 
            ? 'bg-red-600 text-white hover:bg-red-700' 
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        ENV {missingVars.length > 0 ? `(${missingVars.length} missing)` : '✓'}
      </button>
      
      {showDebug && (
        <div className="absolute bottom-12 right-0 bg-white border rounded-lg shadow-lg p-4 w-96 max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Environment Variables Status</h3>
          <div className="space-y-2">
            {envStatus.map((env) => (
              <div key={env.name} className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-600 truncate">
                  {env.name}
                </span>
                <span className={`text-xs font-semibold ${
                  env.isSet ? 'text-green-600' : 'text-red-600'
                }`}>
                  {env.isSet ? '✓ SET' : '✗ MISSING'}
                </span>
              </div>
            ))}
          </div>
          
          {missingVars.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-red-600 font-medium">
                Missing variables: {missingVars.map(v => v.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 