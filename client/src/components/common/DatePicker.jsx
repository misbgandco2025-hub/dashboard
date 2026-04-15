import { forwardRef } from 'react';

const DatePicker = forwardRef(({
  label,
  error,
  required,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `date-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="label-base">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        type="date"
        className={`input-base ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
});
DatePicker.displayName = 'DatePicker';
export default DatePicker;
