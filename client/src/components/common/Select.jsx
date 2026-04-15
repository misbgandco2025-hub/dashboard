import { forwardRef } from 'react';

const SelectField = forwardRef(({
  label,
  error,
  required,
  options = [],
  placeholder = 'Select...',
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="label-base">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={`input-base ${error ? 'input-error' : ''}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
});
SelectField.displayName = 'SelectField';
export default SelectField;
