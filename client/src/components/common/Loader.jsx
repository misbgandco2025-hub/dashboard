import { Loader2 } from 'lucide-react';

const Loader = ({ size = 'md', text = '', fullPage = false }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
        <Loader2 className={`${sizes.lg} animate-spin text-primary-600`} />
        {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className={`${sizes[size] || sizes.md} animate-spin text-primary-500`} />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <div className="animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-4 bg-gray-200 rounded flex-1" style={{ opacity: 1 - j * 0.1 }} />
        ))}
      </div>
    ))}
  </div>
);

export default Loader;
