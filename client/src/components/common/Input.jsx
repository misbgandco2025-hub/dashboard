import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  required,
  type = 'text',
  placeholder,
  className = '',
  prefix: Prefix,
  suffix: Suffix,
  helpText,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="label-base">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Prefix && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Prefix className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          type={type}
          placeholder={placeholder}
          className={`input-base ${Prefix ? 'pl-9' : ''} ${Suffix ? 'pr-9' : ''} ${error ? 'input-error' : ''}`}
          {...props}
        />
        {Suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <Suffix className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>
      {helpText && !error && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
