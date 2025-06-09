import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@web/components/common';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to NewsletterHub</h1>
      <p className="text-gray-600 mb-6 text-center">
        Your one-stop solution for managing and reading newsletters
      </p>
      <div className="flex gap-4">
        <Button onClick={() => navigate('/inbox')}>
          Go to Inbox
        </Button>
        <Button variant="outline" onClick={() => navigate('/newsletters')}>
          Manage Newsletters
        </Button>
      </div>
    </div>
  );
};

export default HomePage;
