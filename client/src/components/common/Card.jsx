const Card = ({
  children,
  className = '',
  padding = 'p-5',
  header,
  footer,
  variant = 'default',
}) => {
  const variants = {
    default: 'card',
    bordered: 'border-2 border-primary-200 rounded-xl bg-white',
    elevated: 'bg-white rounded-xl shadow-md border-0',
  };

  return (
    <div className={`${variants[variant] || variants.default} ${className}`}>
      {header && (
        <div className="px-5 py-4 border-b border-gray-100">
          {typeof header === 'string' ? (
            <h3 className="text-sm font-semibold text-gray-800">{header}</h3>
          ) : header}
        </div>
      )}
      <div className={padding}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
