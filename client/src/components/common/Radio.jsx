import { forwardRef } from 'react';

const Radio = forwardRef(({ label, options = [], error, className = '', value, onChange, name }, ref) => (
  <div className={className}>
    {label && <p className="label-base mb-2">{label}</p>}
    <div className="flex flex-wrap gap-4">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
          <input
            ref={ref}
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={onChange}
            className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">{opt.label}</span>
        </label>
      ))}
    </div>
    {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
  </div>
));
Radio.displayName = 'Radio';
export default Radio;
