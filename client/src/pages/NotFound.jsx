import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
    <div className="text-8xl font-black text-primary-100 mb-2">404</div>
    <SearchX className="h-16 w-16 text-primary-300 mb-4" />
    <h1 className="text-2xl font-bold text-gray-800 mb-2">Page Not Found</h1>
    <p className="text-gray-500 text-sm mb-8 max-w-sm">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <Link to="/dashboard" className="btn btn-primary btn-md inline-flex items-center gap-2">
      <Home className="h-4 w-4" /> Back to Dashboard
    </Link>
  </div>
);

export default NotFound;
