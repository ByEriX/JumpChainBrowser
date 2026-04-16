import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  message?: string;
}

export default function LoadingSpinner({ size = 40, message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 size={size} className="animate-spin text-primary-500" />
      {message && (
        <p className="mt-4 text-gray-400 text-sm">{message}</p>
      )}
    </div>
  );
}
