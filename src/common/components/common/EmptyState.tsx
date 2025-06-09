import React from 'react';
import { motion } from 'framer-motion';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center py-12"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-neutral-800 mb-2">{title}</h3>
      <p className="text-neutral-500 max-w-md mx-auto">{description}</p>
      
      {action && (
        <button 
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;