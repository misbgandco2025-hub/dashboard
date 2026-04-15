import { forwardRef } from 'react';

const Checkbox = forwardRef(({ label, error, className = '', description, ...props }, ref) => (
  <div className={`flex items-start gap-3 ${className}`}>
    <div className="flex items-center h-5 mt-0.5">
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        {...props}
      />
    </div>
    {label && (
      <div>
        <label className="text-sm font-medium text-gray-700 cursor-pointer">{label}</label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        {error && <p className="text-xs text-danger-600 mt-0.5">{error}</p>}
      </div>
    )}
  </div>
));
Checkbox.displayName = 'Checkbox';
export default Checkbox;
