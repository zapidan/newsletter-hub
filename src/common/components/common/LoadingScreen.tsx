import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <div className="bg-primary-500 p-3 rounded-xl mb-4 shadow-lg">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <Inbox className="text-white w-8 h-8" />
          </motion.div>
        </div>
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-slate-100 mb-2">NewsletterHub</h1>
        <p className="text-neutral-500 dark:text-slate-400">Loading your newsletters...</p>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;