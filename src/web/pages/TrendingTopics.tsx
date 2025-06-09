import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight, 
  BarChart2 
} from 'lucide-react';

type Topic = {
  id: string;
  name: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  categories: string[];
};

const TrendingTopics = () => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');
  
  // Mock data
  const topics: Topic[] = [
    { 
      id: '1', 
      name: 'Artificial Intelligence', 
      count: 24, 
      trend: 'up', 
      change: 8,
      categories: ['Technology', 'Research']
    },
    { 
      id: '2', 
      name: 'Climate Change', 
      count: 18, 
      trend: 'up', 
      change: 4,
      categories: ['Environment', 'Politics']
    },
    { 
      id: '3', 
      name: 'Remote Work', 
      count: 16, 
      trend: 'down', 
      change: 3,
      categories: ['Business', 'Lifestyle']
    },
    { 
      id: '4', 
      name: 'Blockchain', 
      count: 12, 
      trend: 'stable', 
      change: 0,
      categories: ['Technology', 'Finance']
    },
    { 
      id: '5', 
      name: 'Mental Health', 
      count: 10, 
      trend: 'up', 
      change: 6,
      categories: ['Health', 'Lifestyle']
    },
    { 
      id: '6', 
      name: 'Data Privacy', 
      count: 9, 
      trend: 'up', 
      change: 2,
      categories: ['Technology', 'Politics']
    },
    { 
      id: '7', 
      name: 'Sustainable Energy', 
      count: 8, 
      trend: 'stable', 
      change: 0,
      categories: ['Environment', 'Technology']
    },
    { 
      id: '8', 
      name: 'Digital Marketing', 
      count: 7, 
      trend: 'down', 
      change: 4,
      categories: ['Business', 'Technology']
    }
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', size = 16) => {
    if (trend === 'up') return <ArrowUp size={size} className="text-success-500" />;
    if (trend === 'down') return <ArrowDown size={size} className="text-error-500" />;
    return <ArrowRight size={size} className="text-neutral-500" />;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Trending Topics</h2>
          <p className="text-neutral-500 mt-1">
            Topics and themes across your newsletters
          </p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white border border-neutral-200 rounded-md p-1">
          <button 
            className={`px-3 py-1.5 rounded text-sm ${
              timeframe === 'week' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-neutral-600'
            }`}
            onClick={() => setTimeframe('week')}
          >
            Week
          </button>
          <button 
            className={`px-3 py-1.5 rounded text-sm ${
              timeframe === 'month' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-neutral-600'
            }`}
            onClick={() => setTimeframe('month')}
          >
            Month
          </button>
          <button 
            className={`px-3 py-1.5 rounded text-sm ${
              timeframe === 'all' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-neutral-600'
            }`}
            onClick={() => setTimeframe('all')}
          >
            All time
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Total Topics</p>
              <h3 className="text-2xl font-bold">48</h3>
            </div>
            <div className="bg-neutral-100 p-2 rounded-md">
              <BarChart2 className="text-neutral-600" size={20} />
            </div>
          </div>
          <div className="mt-2 text-xs text-success-700 flex items-center">
            <ArrowUp size={12} className="mr-1" />
            <span>12% increase from last {timeframe}</span>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Most Popular</p>
              <h3 className="text-xl font-bold">Artificial Intelligence</h3>
            </div>
            <div className="bg-primary-100 p-2 rounded-md">
              <TrendingUp className="text-primary-600" size={20} />
            </div>
          </div>
          <div className="mt-2 text-xs text-success-700 flex items-center">
            <ArrowUp size={12} className="mr-1" />
            <span>24 mentions this {timeframe}</span>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Trending Category</p>
              <h3 className="text-xl font-bold">Technology</h3>
            </div>
            <div className="bg-accent-100 p-2 rounded-md">
              <Calendar className="text-accent-600" size={20} />
            </div>
          </div>
          <div className="mt-2 text-xs text-success-700 flex items-center">
            <ArrowUp size={12} className="mr-1" />
            <span>3 new topics this {timeframe}</span>
          </div>
        </div>
      </div>

      {/* Main trending topics */}
      <div className="card">
        <div className="p-4 border-b border-neutral-200">
          <h3 className="font-medium">Top Trends</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left py-3 px-4 text-neutral-600 font-medium text-sm">Rank</th>
                <th className="text-left py-3 px-4 text-neutral-600 font-medium text-sm">Topic</th>
                <th className="text-left py-3 px-4 text-neutral-600 font-medium text-sm">Mentions</th>
                <th className="text-left py-3 px-4 text-neutral-600 font-medium text-sm">Trend</th>
                <th className="text-left py-3 px-4 text-neutral-600 font-medium text-sm">Categories</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic, index) => (
                <motion.tr 
                  key={topic.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                >
                  <td className="py-3 px-4 text-sm">
                    <div className="flex items-center justify-center w-6 h-6 bg-neutral-100 rounded-full">
                      {index + 1}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium">
                    {topic.name}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {topic.count} mentions
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(topic.trend)}
                      <span className={`text-sm ${
                        topic.trend === 'up' ? 'text-success-500' : 
                        topic.trend === 'down' ? 'text-error-500' : 
                        'text-neutral-500'
                      }`}>
                        {topic.trend === 'stable' 
                          ? 'No change' 
                          : `${topic.change} ${topic.trend === 'up' ? 'more' : 'fewer'}`
                        }
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {topic.categories.map(category => (
                        <span 
                          key={category} 
                          className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-700 rounded-full"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrendingTopics;