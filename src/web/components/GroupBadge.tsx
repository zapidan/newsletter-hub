import { X } from 'lucide-react';
import React from 'react';

interface GroupBadgeProps {
  id: string;
  name: string;
  color?: string;
  isActive?: boolean;
  isClickable?: boolean;
  onRemove?: (id: string) => void;
  onClick?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filter' | 'preview';
  className?: string;
}

const GroupBadge: React.FC<GroupBadgeProps> = ({
  id,
  name,
  color = '#3B82F6',
  isActive = false,
  isClickable = true,
  onRemove,
  onClick,
  size = 'sm',
  variant = 'default',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const baseClasses = `
    inline-flex items-center gap-1 rounded-full font-medium transition-all duration-200
    ${sizeClasses[size]}
    ${className}
  `;

  const getVariantClasses = () => {
    switch (variant) {
      case 'filter':
        return isActive
          ? `bg-opacity-100 border-2 ring-2 ring-offset-1`
          : `bg-opacity-60 border border-opacity-50 hover:bg-opacity-80`;
      case 'preview':
        // Use subtle background similar to inactive filter chips for readability
        return `bg-opacity-60 border border-opacity-40`;
      default:
        return `bg-opacity-100`;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClickable && onClick) {
      onClick(id);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(id);
    }
  };

  const badgeStyle = {
    backgroundColor:
      // Inactive filter chips are light tinted
      (variant === 'filter' && !isActive)
        ? `${color}30`
        // Preview chips in rows should also be light tinted for contrast
        : (variant === 'preview')
          ? `${color}30`
          // Default: solid color, typically for active state
          : `${color}${isActive ? 'FF' : 'CC'}`,
    borderColor: color,
    color:
      // For light tinted backgrounds, keep colored text
      (variant === 'filter' && !isActive) || variant === 'preview'
        ? color
        : (isActive ? '#FFFFFF' : color),
    ringColor: isActive ? color : undefined,
  };

  return (
    <span
      className={`
        ${baseClasses}
        ${getVariantClasses()}
        ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
        ${isActive ? 'shadow-sm' : ''}
      `}
      style={badgeStyle}
      onClick={handleClick}
      title={isClickable ? `Click to ${isActive ? 'remove' : 'apply'} ${name} filter` : name}
      data-testid={`group-badge-${id}`}
      data-active={isActive}
      data-variant={variant}
    >
      <span className="truncate max-w-24">{name}</span>

      {variant === 'filter' && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-1 rounded-full hover:bg-black hover:bg-opacity-10 p-0.5 transition-colors"
          title={`Remove ${name} filter`}
          data-testid={`group-badge-remove-${id}`}
        >
          <X size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} />
        </button>
      )}

      {variant === 'filter' && isActive && (
        <span className="sr-only">
          {name} filter is active
        </span>
      )}
    </span>
  );
};

export default GroupBadge;
