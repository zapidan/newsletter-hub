import { format } from 'date-fns';

const DailySummary = () => {
  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-800 mb-2">Daily Summary</h1>
      <p className="text-neutral-600 mb-8">{formattedDate}</p>
      
      <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
        <p className="text-neutral-600 text-center py-8">
          Your daily summary for the configured newsletters will appear here. Please configure it in settings.
        </p>
      </div>
    </div>
  );
};

export default DailySummary;
